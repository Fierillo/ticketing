'use server';

import { prisma } from '@/services/prismaClient';
import { Order, Ticket, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Event } from 'nostr-tools';

export interface CreateOrderResponse {
  eventReferenceId: string;
}

export interface UpdatePaidOrderResponse57 {
  tickets: Ticket[];
  alreadyPaid: boolean;
  eventReferenceId: string;
}

export interface UpdatePaidOrderResponse21 {
  tickets: Ticket[];
  alreadyPaid: boolean;
  eventReferenceId: string;
}

export interface CheckInTicketResponse {
  alreadyCheckedIn: boolean;
  checkIn: boolean;
}

export interface CreateInviteResponse {
  ticketList: [string, string][];
}

export interface UpdatePaidOrderByVerifyUrlResponse {
  tickets: Ticket[];
  alreadyPaid: boolean;
  eventReferenceId: string;
  email: string;
}

// Create order and user (or update), not yet create ticket
async function createOrder(
  fullname: string,
  email: string,
  ticketQuantity: number,
  totalMiliSats: number
): Promise<CreateOrderResponse> {
  const eventReferenceId: string = randomBytes(32).toString('hex');

  const { order, user } = await prisma.$transaction(async () => {
    // Create or update user
    const user: User | null = await prisma.user.upsert({
      where: {
        email,
      },
      update: {},
      create: { fullname, email },
    });

    // Create order
    const order: Order | null = await prisma.order.create({
      data: {
        eventReferenceId,
        ticketQuantity,
        totalMiliSats,
        userId: user.id,
      },
    });

    return { order, user };
  });

  if (!order || !user) {
    throw new Error('Order or user not created');
  }

  const response: CreateOrderResponse = {
    eventReferenceId,
  };

  return response;
}

// LUD-21
async function updatePaidOrder21(
  eventReferenceId: string,
  code: string | null,
  type: string
): Promise<UpdatePaidOrderResponse21> {
  const { tickets, alreadyPaid } = await prisma.$transaction(async (tx) => {
    // Get unpaid order
    const existingOrder = await tx.order.findUnique({
      where: { eventReferenceId },
      select: { paid: true, id: true, userId: true, ticketQuantity: true },
    });

    if (!existingOrder) {
      console.log('Order not found');
      throw new Error('Order not found');
    }

    if (existingOrder.paid) {
      console.log('Order already paid');
      return { order: null, tickets: [], alreadyPaid: true };
    }

    if (!existingOrder.userId) {
      throw new Error('User not found');
    }
    // Update order to paid

    const result = await tx.order.updateMany({
      where: { eventReferenceId, paid: false },
      data: {
        paid: true,
      },
    });

    if (result.count === 0) {
      // No update happened → already paid or not found
      return { tickets: [], alreadyPaid: true, eventReferenceId };
    }

    if (code) {
      await tx.code.upsert({
        where: { code },
        update: {
          used: {
            increment: 1,
          },
        },
        create: {
          code,
          used: 1,
          discount: 0,
        },
      });
    }

    // Create tickets
    let tickets: Ticket[] = [];

    // Get the current greatest serial number
    const lastTicket = await tx.ticket.findFirst({
      where: {
        type: type,
      },
      orderBy: {
        serial: 'desc',
      },
    });
    let currentSerial = lastTicket ? lastTicket.serial : 0;

    for (let i = 0; i < existingOrder.ticketQuantity; i++) {
      const ticketId: string = randomBytes(16).toString('hex');

      const ticket: Ticket | null = await tx.ticket.create({
        data: {
          ticketId,
          userId: existingOrder.userId,
          orderId: existingOrder.id,
          serial: ++currentSerial,
          type,
        },
      });

      tickets.push(ticket);
    }

    return { tickets, alreadyPaid: false };
  });

  if (alreadyPaid) {
    return { tickets: [], alreadyPaid, eventReferenceId };
  }

  if (tickets.length === 0) {
    throw new Error('Order or user not found or ticket not created');
  }

  return { tickets, alreadyPaid, eventReferenceId };
}

async function checkInTicket(ticketId: string): Promise<CheckInTicketResponse> {
  const { alreadyCheckedIn, checkIn } = await prisma.$transaction(
    // To Do: optimize this query with conditional update
    async (tx) => {
      // Find ticket
      const ticket: Ticket | null = await tx.ticket.findUnique({
        where: {
          ticketId,
        },
      });

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Check if ticket is already checked in
      let alreadyCheckedIn = false;

      if (ticket.checkIn) {
        alreadyCheckedIn = true;

        return { alreadyCheckedIn, checkIn: true };
      }

      // Update ticket to checked in
      const ticketChecked: Ticket = await tx.ticket.update({
        where: {
          ticketId,
        },
        data: {
          checkIn: true,
        },
      });

      if (!ticketChecked) {
        throw new Error('Error checking in ticket');
      }

      return { alreadyCheckedIn: false, checkIn: true };
    }
  );

  const response: CheckInTicketResponse = {
    alreadyCheckedIn,
    checkIn,
  };

  return response;
}

// Add user to database
async function createInvite(
  action: string,
  list: [string, string][]
): Promise<CreateInviteResponse> {
  const { ticketList } = await prisma.$transaction(async (tx) => {
    let ticketList: [string, string][] = [];

    if (action === 'add') {
      for (const [fullname, email] of list) {
        console.log(fullname, email);
        // Create user
        const user = await tx.user.upsert({
          where: {
            email,
          },
          update: {
            fullname,
          },
          create: {
            fullname,
            email,
          },
        });

        console.log(user);

        // Create ticket for the user
        const ticketId: string = randomBytes(16).toString('hex');

        const ticket: Ticket = await tx.ticket.create({
          data: {
            ticketId,
            userId: user.id,
            orderId: null,
            type: 'general',
            serial: 0,
          },
        });

        ticketList.push([user.email, ticket.ticketId!]);
      }
    } else if (action === 'remove') {
      // TODO: Implement this
      // const emails = list.map(([_, email]) => email); // Extract emails from the array
      // // Remove users and their related tickets
      // const ticket = await prisma.ticket.deleteMany({
      //   where: {
      //     User: {
      //       email: {
      //         in: emails,
      //       },
      //     },
      //   },
      // });
      // tickets.push(ticket.ticketId!);
      // await prisma.user.deleteMany({
      //   where: {
      //     email: {
      //       in: emails,
      //     },
      //   },
      // });
    }

    return { ticketList };
  });

  if (ticketList.length === 0) {
    throw new Error('Failed to create invite');
  }

  const response: CreateInviteResponse = {
    ticketList,
  };

  return response;
}

// Function to count total tickets in the database
async function countTotalTickets(type: string): Promise<number> {
  const lastTicket = await prisma.ticket.findFirst({
    where: {
      type: type,
    },
    orderBy: {
      serial: 'desc',
    },
  });

  return lastTicket ? lastTicket.serial : 0;
}

// Function to get ticket in the database by id
async function getTicket(id: string): Promise<Ticket | null> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id,
      },
    });

    return ticket;
  } catch (error) {
    return null;
  }
}

// Function to get tickets
async function getTickets(): Promise<Ticket[] | null> {
  try {
    const ticket = await prisma.ticket.findMany({
      include: {
        User: {
          select: {
            fullname: true,
            email: true,
          },
        },
      },
    });

    return ticket;
  } catch (error) {
    return null;
  }
}

export {
  checkInTicket,
  countTotalTickets,
  createInvite,
  createOrder,
  updatePaidOrder21,
  getTicket,
  getTickets,
};

import {
  updatePaidOrder21,
  UpdatePaidOrderResponse21,
} from '@/lib/utils/prisma';
import { prisma } from '@/services/prismaClient';
import { ses } from '@/services/ses';
import { NextResponse } from 'next/server';

import { TICKET } from '@/config/mock';

export async function POST(request: Request) {
  try {
    console.log('Starting POST request to /api/ticket/verify');
    const { eventReferenceId, code, email } = (await request.json()) as {
      eventReferenceId: string;
      code: string;
      email: string;
    };
    console.log(
      `Received request with eventReferenceId: ${eventReferenceId} and email: ${email}`
    );

    // get order from eventReferenceId
    console.log(`Looking up order with eventReferenceId: ${eventReferenceId}`);
    const order = await prisma.order.findUnique({
      where: { eventReferenceId },
      select: {
        id: true,
        verifyUrl: true,
        paid: true,
      },
    });

    if (!order) {
      console.log(`Order not found for eventReferenceId: ${eventReferenceId}`);
      throw new Error('Order not found');
    }

    if (order.paid) {
      console.log(
        `Order already paid for eventReferenceId: ${eventReferenceId}`
      );
      return NextResponse.json({ settled: true }, { status: 200 });
    }

    if (!order.verifyUrl) {
      console.log(`Verify URL not found for order: ${eventReferenceId}`);
      throw new Error('Verify URL not found');
    }

    console.log(`Fetching payment status from: ${order.verifyUrl}`);
    const res = await fetch(order.verifyUrl);

    if (!res.ok) {
      console.log(`LUD-21 verification failed with status: ${res.status}`);
      return NextResponse.json({ error: 'Error en LUD-21' }, { status: 402 });
    }

    const { settled } = (await res.json()) as { settled: boolean };
    console.log(`Payment settled status: ${settled}`);

    if (!settled) {
      console.log('Payment is not settled, returning 202');
      return NextResponse.json(
        { error: 'Payment not settled', settled },
        { status: 202 }
      );
    }

    // Prisma
    let updateOrderResponse: UpdatePaidOrderResponse21;
    try {
      updateOrderResponse = await updatePaidOrder21(
        eventReferenceId,
        code || null,
        TICKET.type || 'general'
      );
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Couldnt update order' },
        { status: 400 }
      );
    }

    if (updateOrderResponse.alreadyPaid) {
      return NextResponse.json({ settled: true }, { status: 200 });
    }

    // Check if there are tickets to send
    if (updateOrderResponse?.tickets.length > 0) {
      try {
        for (const ticket of updateOrderResponse.tickets) {
          await ses.sendEmailOrder(
            email,
            ticket.ticketId!,
            ticket.type,
            ticket.serial
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          {
            reason: 'Error at sending emails',
            message: (error as Error).message,
          },
          { status: 500 }
        );
      }
    }

    console.log('Payment via LUD-21 confirmed');
    return NextResponse.json({ settled }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

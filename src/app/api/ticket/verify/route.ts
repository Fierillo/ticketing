import { validateEmail } from '@/lib/utils';
import { prisma } from '@/services/prismaClient';
import { ses } from '@/services/ses';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('Starting POST request to /api/ticket/verify');

    const { eventReferenceId, email } = (await request.json()) as {
      eventReferenceId: string;
      email: string;
    };
    console.log(
      `Received request with eventReferenceId: ${eventReferenceId} and email: ${email}`
    );

    if (!validateEmail(email)) {
      console.log(`Invalid email format: ${email}`);
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // get order from eventReferenceId
    console.log(`Looking up order with eventReferenceId: ${eventReferenceId}`);
    const order = await prisma.order.findUnique({
      where: { eventReferenceId },
      select: {
        verifyUrl: true,
        paid: true,
      },
    });

    if (!order) {
      console.log(`Order not found for eventReferenceId: ${eventReferenceId}`);
      throw new Error('Order not found');
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

    if (settled) {
      console.log('Payment is settled, updating order status');
      // Get current order status before update
      const { wasUpdated, updatedOrder } = await prisma.$transaction(
        async () => {
          const currentOrder = await prisma.order.findUnique({
            where: { eventReferenceId },
            select: {
              paid: true,
            },
          });

          if (!currentOrder) {
            console.log(
              `Order not found during transaction: ${eventReferenceId}`
            );
            throw new Error('Order not found before update');
          }

          if (currentOrder.paid) {
            console.log(`Order already paid: ${eventReferenceId}`);
            return { wasUpdated: false, updatedOrder: currentOrder };
          }

          // Update order in Prisma
          const updatedOrder = await prisma.order.update({
            where: { eventReferenceId },
            data: { paid: true },
            select: {
              paid: true,
              eventReferenceId: true,
            },
          });

          return { wasUpdated: true, updatedOrder };
        }
      );

      console.log(`Order payment status changed to paid`);

      if (!wasUpdated) {
        console.log(
          'Order payment status was not changed, already in desired state'
        );
        return NextResponse.json(
          { error: 'Order payment status not changed' },
          { status: 400 }
        );
      }

      // If verified, send email to client
      console.log(`Sending confirmation email to: ${email}`);
      await ses.sendEmailOrder(email, eventReferenceId);
      console.log('Payment via LUD-21 confirmed');
      return NextResponse.json({ settled }, { status: 200 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

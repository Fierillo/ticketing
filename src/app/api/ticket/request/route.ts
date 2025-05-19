import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { sendy } from '@/services/sendy';
import { ses } from '@/services/ses';
import { getLnurlpFromWalias, generateInvoice } from '@/services/ln';
import { prisma } from '@/services/prismaClient';

import { calculateCurrencyToSats } from '@/lib/utils/price';
import { AppError } from '@/lib/errors/appError';
import { getCodeDiscountFront } from '@/lib/utils/codes';
import { countTotalTickets, createOrder } from '@/lib/utils/prisma';
import { generateZapRequest, senderPublicKey } from '@/lib/utils/nostr';

import { TICKET } from '@/config/mock';

let walias = process.env.NEXT_POS_WALIAS!;
let listId = process.env.NEXT_SENDY_LIST_ID;

const requestOrderSchema = z.object({
  fullname: z.string().min(3, { message: 'Fullname is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  ticketQuantity: z
    .number()
    .int()
    .lt(10)
    .positive({ message: 'Ticket Quantity must be a number' }),
  newsletter: z.boolean({ message: 'Newsletter must be a boolean' }),
  code: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Method & env-vars check
    if (req.method !== 'POST') throw new AppError('Method not allowed', 405);

    // 2. Validate request body
    const body = await req.json();
    const parsed = requestOrderSchema.safeParse(body);
    if (!parsed.success)
      throw new AppError(parsed.error.errors[0].message, 400);
    const { fullname, email, ticketQuantity, newsletter, code } = parsed.data;

    // 3. Fetch discount & LNURLP concurrently
    const [discount, lnurlp] = await Promise.all([
      code ? getCodeDiscountFront(code.toUpperCase()) : Promise.resolve(1),
      getLnurlpFromWalias(walias),
    ]);
    if (!lnurlp?.callback) throw new AppError('Invalid LNURLP data', 500);

    // Consultar la cantidad total de tickets
    const totalTickets = await countTotalTickets(TICKET.type);

    const unitPrice = Number(TICKET?.value);
    const blockValue =
      TICKET?.type === 'general' ? 0 : Math.floor(totalTickets / 21);
    const total = Math.round(
      (unitPrice + Number(blockValue * 10)) * ticketQuantity * discount
    );

    if (isNaN(unitPrice)) throw new AppError('Invalid ticket price', 500);

    const priceInSats = await calculateCurrencyToSats(TICKET?.currency, total);
    const totalMsats = priceInSats * 1000;

    // 5. Create order & (optional) subscribe to newsletter in parallel
    const [orderResp] = await Promise.all([
      createOrder(fullname, email, ticketQuantity, totalMsats),
      (async () => {
        if (!newsletter) return;
        const resp = await sendy.subscribe({
          name: fullname,
          email,
          listId: listId!,
        });
        if (resp.success && resp.message !== 'Already subscribed') {
          await ses.sendEmailNewsletter(email);
        }
      })(),
    ]);

    const eventReferenceId = orderResp.eventReferenceId;

    // 6. Generate zap request
    const zapRequest = generateZapRequest(
      eventReferenceId,
      totalMsats,
      senderPublicKey
    );

    // 7. Generate invoice & setup listener concurrently
    const [invoice] = await Promise.all([
      (async () => {
        const { pr, verify } = await generateInvoice(
          lnurlp.callback,
          totalMsats,
          zapRequest
        );
        await prisma.order.update({
          where: { eventReferenceId },
          data: { verifyUrl: verify },
        });
        return { pr, verify };
      })(),
    ]);

    // 8. Return response
    return NextResponse.json({
      status: true,
      data: {
        pr: invoice.pr,
        verify: invoice.verify,
        eventReferenceId,
        code: code ?? null,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/ticket/request:', error);
    Sentry.captureException(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    const message = error.message || 'Internal Server Error';
    return NextResponse.json({ status: false, errors: message }, { status });
  }
}

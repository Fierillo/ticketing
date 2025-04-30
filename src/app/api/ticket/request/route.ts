import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { sendy } from '@/services/sendy';
import { ses } from '@/services/ses';
import { getLnurlpFromWalias, generateInvoice } from '@/services/ln';
import { prisma } from '@/services/prismaClient';

import { calculateCurrencyToSats } from '@/lib/utils/price';
import { AppError } from '@/lib/errors/appError';
import { requestOrderSchema } from '@/lib/validation/requestOrderSchema';
import { getCodeDiscountFront } from '@/lib/utils/codes';
import { createOrder } from '@/lib/utils/prisma';
import {
  generateZapRequest,
  setupPaymentListener,
  senderPublicKey,
} from '@/lib/utils/nostr';

import { TICKET } from '@/config/mock';

let apiUrl = process.env.NEXT_PUBLIC_API_URL;
let walias = process.env.NEXT_POS_WALIAS;
let listId = process.env.NEXT_SENDY_LIST_ID;

export async function POST(req: NextRequest) {
  try {
    // 1. Method & env-vars check
    if (req.method !== 'POST') throw new AppError('Method not allowed', 405);
    if (!apiUrl || !walias) {
      const missing = !apiUrl ? 'NEXT_PUBLIC_API_URL' : 'NEXT_POS_WALIAS';
      throw new AppError(`${missing} is not defined`, 500);
    }

    // 2. Validate request body
    const body = await req.json();
    const parsed = requestOrderSchema.safeParse(body);
    if (!parsed.success)
      throw new AppError(parsed.error.errors[0].message, 400);
    const { fullname, email, ticketQuantity, newsletter, code } = parsed.data;

    // 3. Fetch discount & LNURLP concurrently
    const [discount, lnurlp] = await Promise.all([
      code ? getCodeDiscountFront(code.toLowerCase()) : Promise.resolve(1),
      getLnurlpFromWalias(walias),
    ]);
    if (!lnurlp?.callback) throw new AppError('Invalid LNURLP data', 500);

    // 4. Calculate total msats
    const unitPrice = Number(TICKET?.value);
    const total = Number(TICKET?.value) * ticketQuantity * discount;

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
        if (resp.success || resp.message === 'Already subscribed') {
          if (resp.message !== 'Already subscribed') {
            await ses.sendEmailNewsletter(email);
          }
        } else {
          throw new AppError(`Newsletter error: ${resp.message}`, 400);
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
      setupPaymentListener(eventReferenceId, fullname, email, apiUrl),
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

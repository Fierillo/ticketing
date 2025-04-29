import { AppError } from '@/lib/errors/appError';
import { getCodeDiscountBack } from '@/lib/utils/codes';
import {
  generateZapRequest,
  setupPaymentListener,
  senderPublicKey,
} from '@/lib/utils/nostr';
import { createOrder, CreateOrderResponse } from '@/lib/utils/prisma';
import { requestOrderSchema } from '@/lib/validation/requestOrderSchema';
import { sendy } from '@/services/sendy';
import { ses } from '@/services/ses';
import { NextRequest, NextResponse } from 'next/server';
import { Event } from 'nostr-tools';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/services/prismaClient';
import { generateInvoice, getLnurlpFromWalias } from '@/services/ln';

interface RequestTicketResponse {
  pr: string;
  verify: string;
  eventReferenceId: string;
  code: string | null;
}

// Validates request body
async function validateRequestBody(req: NextRequest) {
  const body = await req.json();
  const result = requestOrderSchema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors[0].message, 400);
  }
  return result.data;
}

// Calculate total milisats
async function calculateTotalMiliSats(ticketQuantity: number, code?: string) {
  const ticketPriceArs = parseInt(process.env.NEXT_TICKET_PRICE_ARS!);
  const discountMultiple = code ? await getCodeDiscountBack(code.toLowerCase()) : 1;
  const discountedPriceArs = parseInt((ticketPriceArs * discountMultiple).toFixed(0));
  return discountedPriceArs * ticketQuantity * 1000; // Convertir a milisatoshis
}

// Handles newsletter subscription
async function handleNewsletterSubscription(fullname: string, email: string, newsletter: boolean) {
  if (!newsletter) return;

  const sendyResponse = await sendy.subscribe({
    name: fullname,
    email,
    listId: process.env.NEXT_SENDY_LIST_ID!,
  });

  if (sendyResponse.message !== 'Already subscribed') {
    if (!sendyResponse.success) {
      throw new AppError(`Subscribe to newsletter failed. ${sendyResponse.message}`, 404);
    }

    try {
      await ses.sendEmailNewsletter(email);
    } catch (error: any) {
      throw new AppError(error.message || 'Failed to send email via SES', 500);
    }
  }
}

// Main function
export async function POST(req: NextRequest) {
  try {
    if (req.method !== 'POST') {
      throw new AppError('Method not allowed', 405);
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new AppError('NEXT_PUBLIC_API_URL is not defined', 500);
    }
    const { fullname, email, ticketQuantity, newsletter, code } = await validateRequestBody(req);
    const totalMiliSats = await calculateTotalMiliSats(ticketQuantity, code);
    
    // Creates Prisma order
    let orderResponse: CreateOrderResponse;
    try {
      orderResponse = await createOrder(fullname, email, ticketQuantity, totalMiliSats);
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw new AppError('Failed to create order.', 500);
    }
    // Calls handle newsletter function
    await handleNewsletterSubscription(fullname, email, newsletter);

    // Zap Request
    let zapRequest: Event;
    try {
      zapRequest = generateZapRequest(
        orderResponse.eventReferenceId,
        totalMiliSats,
        senderPublicKey,
      );
    } catch (error: any) {
      throw new AppError('Failed to generate Zap Request', 500);
    }

    // Listen for payment
    await setupPaymentListener(
      orderResponse.eventReferenceId,
      fullname,
      email,
      apiUrl,
    );

    // Invoice generation
    let url;
    let pr;
    let callbackUrl;
    if (!process.env.NEXT_POS_WALIAS) {
      throw new AppError('NEXT_POS_WALIAS is not defined', 500);
    }
    url = await getLnurlpFromWalias(process.env.NEXT_POS_WALIAS)
    if (!url) {
      throw new AppError('Failed to get LNURLP from walias', 500);
    }
    callbackUrl = url.callback;
    let verify: string;
    try {
      ({ pr, verify } = await generateInvoice(
        callbackUrl,
        totalMiliSats,
        zapRequest,
      ));
      await prisma.order.update({
        where: { eventReferenceId: orderResponse.eventReferenceId },
        data: { verifyUrl: verify },
      });
    } catch (error: any) {
      throw new AppError('Failed to generate Invoice', 500);
    }

    // Response
    const response: RequestTicketResponse = {
      pr,
      verify,
      eventReferenceId: orderResponse.eventReferenceId,
      code: code || null,
    };

    console.log('Returning response:', response);
    return NextResponse.json({
      status: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Error in /api/ticket/request:', error);
    Sentry.captureException(error);
    const statusCode = error.statusCode || 500;
    return NextResponse.json(
      { status: false, errors: error.message || 'Internal Server Error' },
      { status: statusCode }
    );
  }
}
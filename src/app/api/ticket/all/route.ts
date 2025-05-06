import { getTickets } from '@/lib/utils/prisma';
import { AppError } from '@/lib/errors/appError';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET(req: NextRequest) {
  try {
    if (req.method !== 'GET') {
      throw new AppError('Method not allowed', 405);
    }

    const ticket = await getTickets();

    return NextResponse.json({
      status: true,
      data: ticket,
    });
  } catch (error: any) {
    Sentry.captureException(error);

    return NextResponse.json({
      status: false,
      errors: error.message || 'Failed to count tickets',
    });
  }
}

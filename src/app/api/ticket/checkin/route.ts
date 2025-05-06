import { AppError } from '@/lib/errors/appError';
import { checkInTicket } from '@/lib/utils/prisma';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

interface CheckInResponse {
  checkIn: boolean;
  alreadyCheckedIn: boolean;
}

export async function POST(req: NextRequest) {
  try {
    if (req.method !== 'POST') {
      throw new AppError('Method not allowed', 405);
    }

    // Auth event
    const { ticketId } = await req.json();

    if (!ticketId) {
      throw new AppError('Missing ticketId', 400);
    }

    const { alreadyCheckedIn, checkIn } = await checkInTicket(ticketId);

    const data: CheckInResponse = {
      alreadyCheckedIn,
      checkIn,
    };

    return NextResponse.json({
      status: true,
      data,
    });
  } catch (error: any) {
    Sentry.captureException(error);

    return NextResponse.json(
      { status: false, errors: error.message || 'Internal Server Error' },
      { status: error.statusCode || 500 }
    );
  }
}

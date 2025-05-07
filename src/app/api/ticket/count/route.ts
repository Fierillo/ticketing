import { countTotalTickets } from '@/lib/utils/prisma';
import { AppError } from '@/lib/errors/appError';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// import mock file
import { TICKET } from '@/config/mock';

export async function GET(req: NextRequest) {
  console.info('Counting tickets...');
  try {
    if (req.method !== 'GET') {
      throw new AppError('Method not allowed', 405);
    }

    const { searchParams } = new URL(req.url);
    const rnd = searchParams.get('rnd');

    const totalTickets = await countTotalTickets(TICKET.type);
    console.info(`Counted ${totalTickets} tickets`);

    const response = NextResponse.json({
      status: true,
      data: { totalTickets, algo: rnd || Math.random() },
    });

    // Prevent caching
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error: any) {
    Sentry.captureException(error);

    const errorResponse = NextResponse.json({
      status: false,
      errors: error.message || 'Failed to count tickets',
    });

    // Prevent caching for error responses too
    errorResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');

    return errorResponse;
  }
}

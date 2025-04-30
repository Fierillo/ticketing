// lib/utils/handleAsync.ts
import { AppError } from '@/lib/errors/appError';

type AsyncFunction<T> = () => Promise<T>;

export const handleAsync = async <T>(
  operation: Promise<T> | AsyncFunction<T>,
  errorMessage: string = 'Operation failed',
  errorCode: number = 500 // Default error code
): Promise<T> => {
  try {
    // Execute the operation (either a promise or a function returning a promise)
    return typeof operation === 'function'
      ? await operation()
      : await operation;
  } catch (error: any) {
    // If it's already an AppError, rethrow it to preserve specific status codes/messages
    if (error instanceof AppError) {
      throw error;
    }
    // Otherwise, wrap it in a new AppError with context
    throw new AppError(
      `${errorMessage}: ${error.message || 'Unknown error'}`,
      error.statusCode || errorCode, // Use error's status code if available, else default
      error // Keep original error for logging/debugging
    );
  }
};
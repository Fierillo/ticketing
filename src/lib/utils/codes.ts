import { prisma } from '@/services/prismaClient';

// Backend
export const getCodeDiscountBack = async (code?: string): Promise<number> => {
  if (!code) return 1;
  
  const discount = await prisma.code.findUnique({
    where: { code }
  });

  return discount ? (100 - discount.discount) / 100 : 1;
};

// Frontend
const codes = JSON.parse(process.env.NEXT_DISCOUNT_CODES || '{}');

export const getCodeDiscountFront = (code: string): number => 
  codes[code] ? (100 - codes[code]) / 100 : 1;
// Frontend
const codes = JSON.parse(process.env.NEXT_DISCOUNT_CODES || '{}');

export const getCodeDiscountFront = (code: string): number =>
  codes[code] ? (100 - codes[code]) / 100 : 1;

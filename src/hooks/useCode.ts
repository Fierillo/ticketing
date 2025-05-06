import { getCodeDiscountFront } from '@/lib/utils/codes';
import { useEffect, useState } from 'react';

interface UseCodeReturn {
  discountMultiple: number;
  code: string;
  isLoading: boolean;
  setCode: (code: string) => void;
}

const useCode = (): UseCodeReturn => {
  const [code, setCode] = useState<string>('');
  const [discountMultiple, setDiscountMultiple] = useState<number>(1);
  const [isLoading] = useState<boolean>(false);

  useEffect(() => {
    const codeFix = code.trim().toUpperCase();
    setDiscountMultiple(getCodeDiscountFront(codeFix));
  }, [code]);

  return {
    discountMultiple,
    code,
    isLoading,
    setCode,
  };
};

export default useCode;

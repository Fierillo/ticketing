import {
  OrderClaimReturn,
  OrderRequestData,
  OrderRequestReturn,
  OrderUserData,
} from '@/types/orders';
import { Event } from 'nostr-tools';
import { useCallback, useEffect, useState } from 'react';
import { set } from 'zod';

interface UseOrderReturn {
  isPaid: boolean;
  requestNewOrder: (data: OrderRequestData) => Promise<OrderRequestReturn>;
  claimOrderPayment: (
    data: OrderUserData,
    zapReceiptEvent: Event
  ) => Promise<OrderClaimReturn>;
  clear: () => void;
  setCode: (code: string) => void;
}

const useOrder = (): UseOrderReturn => {
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [verify, setVerify] = useState<string | null>(null);
  const [eventReferenceId, setEventReferenceId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');

  // Call API/ticket/request to fetch invoice, verify and eventReferenceId.
  const requestNewOrder = useCallback(
    async (data: OrderRequestData): Promise<OrderRequestReturn> => {
      setEmail(data.email);
      console.log('requestNewOrder params', data);
      try {
        const response = await fetch('/api/ticket/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${errorData.errors || response.statusText}`);
        }

        const result: { data: OrderRequestReturn } = await response.json();
        setInvoice(result.data.pr);
        setVerify(result.data.verify);
        setEventReferenceId(result.data.eventReferenceId);

        return new Promise((resolve) => {
          console.log('requestNewOrder response', result.data);
          resolve({ ...result.data });
        });
      } catch (error: any) {
        throw error;
      }
    },
    [setIsPaid]
  );

  // Polling LUD-21.
  useEffect(() => {
    if (!invoice || isPaid) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ticket/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventReferenceId,
            code,
            email,
          }),
        });
        const data = await res.json();
        if (data.settled) {
          clearInterval(interval);
          setIsPaid(true);
        }
      } catch {
        //
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [invoice, isPaid, code]);

  // Restart everything.
  const clear = useCallback(() => {
    setIsPaid(false);
    setInvoice(null);
    setVerify(null);
  }, []);

  // NIP-57 validation.
  const claimOrderPayment = async (
    data: OrderUserData,
    zapReceiptEvent: Event
  ): Promise<OrderClaimReturn> => {
    try {
      const body: any = {
        fullname: data.fullname,
        email: data.email,
        zapReceipt: zapReceiptEvent,
        code: data.code,
        eventReferenceId: eventReferenceId,
      };
      console.log('claimOrderPayment params', body);

      throw new Error('Not implemented');
      const response = await fetch(`/api/ticket/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${errorData.errors || response.statusText}`);
      }

      const result: { data: { claim: boolean } } = await response.json();

      if (result.data.claim) {
        setIsPaid(true);
      }

      return new Promise((resolve) => {
        resolve({
          ...result.data,
        });
      });
    } catch (error: any) {
      throw error;
    }
  };

  return {
    setCode,
    isPaid,
    claimOrderPayment,
    requestNewOrder,
    clear,
  };
};

export default useOrder;

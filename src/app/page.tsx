'use client';

import Link from 'next/link';
import { Event } from 'nostr-tools';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Navbar } from '@/components/navbar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { cn } from '@/lib/utils';

// Generic
import { OrderUserData } from '@/types/orders';
import { FormCustomer } from '../features/form-customer';
import { FormPayment } from '../features/form-payment';

// Icons
import { CreditCardValidationIcon } from '@/components/icons/CreditCardValidationIcon';
import { MinusIcon } from '@/components/icons/MinusIcon';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { SleepingIcon } from '@/components/icons/SleepingIcon';

import useCode from '@/hooks/useCode';
import useOrder from '@/hooks/useOrder';
import { useNostr, useSubscription } from '@lawallet/react';
import { convertEvent } from '../lib/utils/nostr';

// Mock data
import { EVENT, TICKET } from '@/config/mock';
import { BlockBar } from '@/components/ui/block-bar';
import { useTicketCount } from '@/hooks/use-ticket-count';
import { convertCurrencyToSats } from '@/lib/utils/price';

const BLOCK_INTERVAL = 21;

export default function Page() {
  // Price
  const [ticketFIATPrice, setTicketFIATPrice] = useState<number | null>(null)
  // Block Price
  const [blockBatch, setBlockBatch] = useState<number>(0);
  // Flow
  const [screen, setScreen] = useState<string>('information');
  const [isLoading, setIsloading] = useState<boolean>(false);
  // Dialog for reset invoice
  const [isOpen, setOpenAlert] = useState<boolean>(false);
  const [alertText, setAlertText] = useState<string>('Try again.');
  // Invoice
  const [userData, setUserData] = useState<OrderUserData | undefined>(
    undefined
  );
  const [ticketQuantity, setTicketQuantity] = useState<number>(1); // Set initial ticket quantity to 1
  const [paymentRequest, setPaymentRequest] = useState<string | undefined>(
    undefined
  );
  const [eventReferenceId, setEventReferenceId] = useState<string | undefined>(
    undefined
  );
  const { maxTicketsReached, totalTickets } = useTicketCount();

  // Hooks
  const {
    isPaid,
    requestNewOrder,
    claimOrderPayment,
    clear,
    setCode: setOrderCode,
  } = useOrder();

  const {
    discountMultiple,
    code,
    isLoading: isCodeLoading,
    setCode: setHookCode,
  } = useCode();

  const setCode = useCallback(
    (code: string) => {
      setOrderCode(code);
      setHookCode(code);
    },
    [setOrderCode, setHookCode]
  );

  // Memoize filters to prevent unnecessary re-renders
  const filters = useMemo(
    () => [{ kinds: [9735], '#e': [eventReferenceId!] }],
    [eventReferenceId]
  );

  // Nostr
  const { validateRelaysStatus } = useNostr();
  const events: Event[] = useMemo(() => [], []);
  // const { events } = useSubscription({
  //   filters,
  //   options: { closeOnEose: false },
  //   enabled: Boolean(eventReferenceId),
  // });

  // const { events, relay, clearEvents } = useRelay({
  //   relayUrl: 'wss://relay.lawallet.ar',
  //   filters,
  //   closeOnEose: false,
  // });

  // Reques order (UI button "Confir Order")
  const handleCreateOrder = useCallback(
    async (data: OrderUserData) => {
      if (isLoading) return;

      setIsloading(true);
      clear();

      setScreen('payment');

      // Create new order
      try {
        const { pr, eventReferenceId, verify } = await requestNewOrder({
          ...data,
          ticketQuantity,
          code,
        });

        // validateRelaysStatus();
        setPaymentRequest(pr);
        setEventReferenceId(eventReferenceId);

        window.scrollTo({
          top: 0,
          behavior: 'auto',
        });

        setUserData({ ...data, code });
      } catch (error: any) {
        setOpenAlert(true);
        setAlertText(error.message);
      } finally {
        setIsloading(false);
      }
    },
    [
      isLoading,
      code,
      ticketQuantity,
      clear,
      requestNewOrder,
      setPaymentRequest,
      setEventReferenceId,
    ]
  );

  // useEffect(() => {
  //   events &&
  //     events.length &&
  //     userData &&
  //     !isPaid &&
  //     processPayment(events[0], userData);
  // }, [events, userData, processPayment, isPaid]);

  // UI Button "Back to page"
  const backToPage = useCallback(() => {
    setScreen('information');
    setEventReferenceId(undefined);
    setTicketQuantity(1);
    setPaymentRequest(undefined);
    setCode('');
    setUserData(undefined);
    clear();
    validateRelaysStatus();
    // clearEvents();
  }, [
    setEventReferenceId,
    setTicketQuantity,
    setPaymentRequest,
    setCode,
    clear,
    validateRelaysStatus,
  ]);

  // Change screen when payment is confirmed
  useEffect(() => {
    if (isPaid && screen === 'payment') {
      setScreen('summary');
    }
  }, [isPaid]);

  useEffect(() => {
    console.log('super totalTickets', totalTickets);
    totalTickets !== null && setBlockBatch(Math.floor(totalTickets / 21));
  }, [totalTickets]);

  useEffect(() => {
    const verifyRelaysConnection = (): void => {
      if (document.visibilityState === 'visible') {
        validateRelaysStatus();
      }
    };

    document.addEventListener('visibilitychange', verifyRelaysConnection);

    return () => {
      document.removeEventListener('visibilitychange', verifyRelaysConnection);
    };
  }, [validateRelaysStatus]);

  // Update ticket price calculations
  const totalPrice = useMemo(async () => {
    try {
      // 1) (Base price + Block increase) * Discount
      const data = (TICKET.value + (TICKET.type === 'general' ? 0 : blockBatch) * 10) * discountMultiple
      setTicketFIATPrice(data)

      // 2) Turn FIAT → SATs
      const satsData = await convertCurrencyToSats(data, TICKET.currency)

      // 3) Calculate total sats
      return satsData * ticketQuantity
    } catch (err: any) {
      console.error('Error calculando precios:', err)
    }
  },[ticketQuantity, blockBatch, discountMultiple]);

  return (
    <>
      <div className="flex flex-col md:flex-row w-full min-h-[100dvh]">
        {/* Aside info */}
        <aside
          className={`bg-black bg-fit bg-[center_top_-420px] relative flex justify-center items-center w-full min-h-full pt-[60px] md:pt-0`}
          style={{
            backgroundImage: `url('/${EVENT?.imageUrl || ''}')`,
          }}
        >
          <Navbar />
          <div
            className={cn(
              'w-full max-w-[520px]  px-4',
              screen === 'information' ? 'my-4' : ''
            )}
          >
            {screen === 'information' ? (
              <>
                <div>
                  <Card className="p-4 gap-2 text-center opacity-95">
                    <div className="flex flex-col">
                      <h1 className="text-2xl font-semibold mb-4 leading-none tracking-tight">
                        {EVENT?.title}
                      </h1>
                      <p>{EVENT?.description}</p>
                    </div>
                    <div className="flex flex-col">
                      <p>Villanueva 1367, CABA</p>
                      <p>{EVENT?.date}</p>
                    </div>
                  </Card>
                </div>
                {!maxTicketsReached && (
                  <>
                    <Card className="p-4 mt-4 opacity-95">
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <p>{TICKET?.title}</p>

                          <p className="font-semibold text-lg">
                            {ticketFIATPrice}{' '}{TICKET?.currency}
                          </p>
                        </div>
                        {TICKET?.type === 'general' && (
                          <div className="flex gap-2 items-center">
                            <Button
                              variant={
                                screen !== 'information' || ticketQuantity === 1 // Change minimum ticket quantity to 1
                                  ? 'ghost'
                                  : 'secondary'
                              }
                              size="icon"
                              onClick={() =>
                                setTicketQuantity(ticketQuantity - 1)
                              }
                              disabled={
                                screen !== 'information' || ticketQuantity === 1 // Change minimum ticket quantity to 1
                              }
                            >
                              <MinusIcon />
                            </Button>
                            <p className="flex items-center justify-center gap-1 w-[40px] font-semibold">
                              {screen !== 'information' && (
                                <span className="font-normal text-xs text-text">
                                  x
                                </span>
                              )}
                              {ticketQuantity}
                            </p>
                            <Button
                              variant={
                                screen !== 'information' ? 'ghost' : 'secondary'
                              }
                              size="icon"
                              onClick={() =>
                                setTicketQuantity(ticketQuantity + 1)
                              }
                              disabled={screen !== 'information'}
                            >
                              <PlusIcon />
                            </Button>
                          </div>
                        )}
                      </div>
                      {TICKET?.type !== 'general' && blockBatch !== null && (
                        <BlockBar
                          totalSquares={5}
                          filled={Math.floor(Number(totalTickets || 0) / 21)}
                          totalTickets={(totalTickets || 0) + 1}
                        />
                      )}
                    </Card>
                    {blockBatch !== null && (
                      <div className="p-4 bg-black bg-opacity-85 mt-4">
                        <div className="flex gap-4 justify-between items-center">
                          <p className="text-text font-bold">Total</p>
                          <div className="text-right">
                            <p className="font-bold text-lg">
                              {totalPrice}{' SAT'}
                            </p>
                            {discountMultiple !== 1 && (
                              <p className="font-semibold text-sm text-primary">
                                {((1 - discountMultiple) * 100).toFixed(0)}
                                {'% OFF'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Accordion
                  type="single"
                  collapsible
                  className="w-full md:hidden"
                >
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="flex gap-2 no-underline">
                      <div className="flex items-center justify-between gap-2 w-full">
                        Show order summary
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Card className="p-4 bg-background">
                        <div className="flex justify-between items-center gap-4">
                          <div>
                            <h2 className="text-md">{TICKET.title}</h2>
                            <p className="font-semibold text-lg">
                              {ticketFIATPrice}{' '}{TICKET?.currency}
                            </p>
                          </div>
                          <div className="flex gap-2 items-center">
                            <p className="flex items-center justify-center gap-1 w-[40px] font-semibold">
                              {screen !== 'information' && (
                                <span className="font-normal text-text">x</span>
                              )}
                              {ticketQuantity}
                            </p>
                          </div>
                        </div>
                      </Card>
                      <div className="p-4 mt-4">
                        <div className="flex gap-4 justify-between items-center">
                          <p className="text-text text-md">Total</p>
                          <div className="flex flex-col text-right">
                            <p className="font-bold text-md">
                              {totalPrice}{' SAT'}
                            </p>
                            {discountMultiple !== 1 && (
                              <p className="font-semibold text-sm text-primary">
                                {((1 - discountMultiple) * 100).toFixed(0)}
                                {'% OFF'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="hidden md:block ">
                  <Card className="p-4 bg-background opacity-95">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h2 className="text-md">{TICKET.title}</h2>
                        <p className="font-semibold text-lg">
                          {ticketFIATPrice}{' '}{TICKET?.currency}
                        </p>
                        <p className="flex items-center justify-center gap-1 w-[40px] font-semibold">
                          <span className="font-normal text-text">x</span>
                          {ticketQuantity}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <div className="p-4 bg-black bg-opacity-85 mt-4">
                    <div className="flex gap-4 justify-between items-center">
                      <p className="text-text font-bold">Total</p>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {totalPrice}{' SAT'}
                        </p>
                        {discountMultiple !== 1 && (
                          <p className="font-semibold text-sm text-primary">
                            {((1 - discountMultiple) * 100).toFixed(0)}
                            {'% OFF'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
        {/* Section data */}
        <section className="relative flex flex-1 md:flex-auto w-full justify-center md:pr-4">
          <div className="flex flex-col gap-4 px-4 w-full py-4 max-w-[520px] pt-[80px]">
            <div className="absolute top-0 left-0 w-full h-[60px] flex justify-center items-center mx-auto  px-4 border-b-[1px] border-border">
              <div className="w-full max-w-[520px]">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage
                        className={cn(
                          '',
                          screen === 'information' ? 'text-white' : 'text-text'
                        )}
                      >
                        Información
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage
                        className={cn(
                          '',
                          screen === 'payment' ? 'text-white' : 'text-text'
                        )}
                      >
                        Pago
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage
                        className={cn(
                          '',
                          screen === 'summary' ? 'text-white' : 'text-text'
                        )}
                      >
                        Resumen
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </div>

            {screen === 'information' && (
              <FormCustomer
                onSubmit={handleCreateOrder}
                discountMultiple={discountMultiple}
                isCodeLoading={isCodeLoading}
                setCode={setCode}
              />
            )}

            {screen === 'payment' && <FormPayment invoice={paymentRequest} />}

            {screen === 'summary' && (
              <>
                <Card>
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full mx-auto py-12 px-8">
                    <CreditCardValidationIcon className="w-8 h-8" />
                    <div className="flex flex-col gap-2 text-center">
                      <h2 className="font-bold text-2xl">Felicitaciones!</h2>
                      <p className="text-text">
                        Tu pago fué confirmado. Te enviamos los detalles a tu
                        casilla de e-mail.
                      </p>
                    </div>
                  </div>
                </Card>
                <Link href="/">
                  <Button
                    className="w-full"
                    variant="link"
                    onClick={backToPage}
                  >
                    Volver
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>
      </div>

      <AlertDialog open={isOpen} onOpenChange={setOpenAlert}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-center">
            <SleepingIcon className="w-8 h-8 color-primary" />
            <AlertDialogTitle className="text-center">
              Oops! Try again
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {alertText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="flex-1 p-0" onClick={backToPage}>
              {/* <Button className="w-full" variant="secondary" tabIndex={-1}> */}
              Reload
              {/* </Button> */}
            </AlertDialogCancel>
            {/* <AlertDialogAction className="flex-1">Try again</AlertDialogAction> */}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

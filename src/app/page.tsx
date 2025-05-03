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
import { Card, CardContent, CardTitle } from '@/components/ui/card';

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
import { calculateTicketPrice, convertCurrencyToSats } from '../lib/utils/price';
import { useRelay } from '@/hooks/useRelay';

// Mock data
import { EVENT, TICKET } from '@/config/mock';
import { blockPrice } from '@/lib/utils/blockPrice';
import { BlockBar } from '@/components/ui/block-bar';

const MAX_TICKETS = parseInt(process.env.NEXT_MAX_TICKETS || '0', 10); // Get the max tickets from env

export default function Page() {
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
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [ticketFiatPrice, setTicketFiatPrice] = useState<number>(TICKET.value);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1); // Set initial ticket quantity to 1
  const [paymentRequest, setPaymentRequest] = useState<string | undefined>(
    undefined
  );
  const [eventReferenceId, setEventReferenceId] = useState<string | undefined>(
    undefined
  );
  const [verifyUrl, setVerifyUrl] = useState<string | undefined>(undefined);
  const [maxTicketsReached, setMaxTicketsReached] = useState<boolean>(false);

  // Hooks
  const { isPaid, requestNewOrder, claimOrderPayment, clear } = useOrder();
  const {
    discountMultiple,
    code,
    isLoading: isCodeLoading,
    setCode,
  } = useCode();

  // Memoize filters to prevent unnecessary re-renders
  const filters = useMemo(
    () => [{ kinds: [9735], '#e': [eventReferenceId!] }],
    [eventReferenceId]
  );

  // Nostr
  const { validateRelaysStatus } = useNostr();
  const { events } = useSubscription({
    filters,
    options: { closeOnEose: false },
    enabled: Boolean(eventReferenceId),
  });
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
        setVerifyUrl(verify);

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

  // Process payment via nostr event
  const processPayment = useCallback(
    async (_event: any, _userData: OrderUserData) => {
      try {
        const event: Event = convertEvent(_event);

        if (!event) {
          console.warn('Event not defined ');
          return;
        }

        if (!_userData) {
          console.warn('User data not defined ');
          return;
        }

        await claimOrderPayment(_userData, event);

        setUserData(undefined);
      } catch (error: any) {
        setOpenAlert(true);
        setAlertText(error.message);
      }
    },
    [claimOrderPayment]
  );

  useEffect(() => {
    events && events.length && userData && processPayment(events[0], userData);
  }, [events, userData, processPayment]);

  // Process payment via LUD-21 (using with useSubscription hook form lawallet/rect)
  // const verifyPayment = useCallback(async () => {
  //   try {
  //     if (!verifyUrl) {
  //       console.warn('Verify URL not defined');
  //       return false;
  //     }

  //     const response = await fetch(verifyUrl);
  //     if (!response.ok) {
  //       throw new Error('Failed to fetch verify payment');
  //     }

  //     const verificationData = await response.json();
  //     if (!verificationData.settled) {
  //       console.warn('Payment not verified');
  //       return false;
  //     }

  //     console.log('====> Payment verified, starting subscription');
  //     subscription?.start();

  //     return true;
  //   } catch (error: any) {
  //     setOpenAlert(true);
  //     setAlertText(error.message);
  //     return false;
  //   }
  // }, [verifyUrl, subscription]);

  // Interval to verify payment via LUD-21 (using with useSubscription hook form lawallet/rect)
  // useEffect(() => {
  //   let intervalId: NodeJS.Timeout | null = null;

  //   const startVerificationInterval = () => {
  //     if (verifyUrl && !isPaid) {
  //       console.log('Setting up verification interval');
  //       intervalId = setInterval(async () => {
  //         const isVerified = await verifyPayment();
  //         if (isVerified) {
  //           console.log('====> Payment verified, clearing interval');
  //           if (intervalId) {
  //             clearInterval(intervalId);
  //             intervalId = null;
  //           }
  //         }
  //       }, 2000);
  //     }
  //   };

  //   startVerificationInterval();

  //   return () => {
  //     if (intervalId) {
  //       console.log('Clearing interval on cleanup');
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [verifyUrl, isPaid, verifyPayment]);

  // UI Button "Back to page"
  const backToPage = useCallback(() => {
    setScreen('information');
    setEventReferenceId(undefined);
    setTicketQuantity(1);
    setPaymentRequest(undefined);
    setVerifyUrl(undefined);
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

  // Update ticket price calculations
  // useEffect(() => {
  //   const calculatePrices = async () => {
  //     try {
  //       // Calculate discounted price in SAT
  //       const discountedPriceSAT = Math.round(TICKET.value * discountMultiple);
  //       setTicketPriceSAT(discountedPriceSAT);

  //       // Calculate total in ARS
  //       const totalMiliSats = Math.round(
  //         await calculateTicketPrice(ticketQuantity, discountedPriceSAT)
  //       );

  //       setTotalMiliSats(totalMiliSats);
  //     } catch (error: any) {
  //       console.error('Error calculating ticket prices:', error);
  //     }
  //   };

  //   calculatePrices();
  // }, [ticketQuantity, discountMultiple]);

  // Change screen when payment is confirmed
  useEffect(() => {
    if (isPaid) {
      setScreen('summary');
    }
  }, [isPaid]);

  // Fetch block price
  useEffect(() => {
    const fetchBlockPrice = async () => {
      try {
        const { totalSold, blockValue } = await blockPrice();
        setBlockBatch(blockValue);
        console.log('ticketPrice', TICKET.value);
      } catch (error: any) {
        console.error('Error fetching block price:', error);
      }
    };

    TICKET?.type !== 'general' && fetchBlockPrice();
  }, []);

  // Check total tickets in the database on component mount
  useEffect(() => {
    const checkTickets = async () => {
      try {
        const response = await fetch('/api/ticket/count', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${errorData.errors || response.statusText}`);
        }

        const data = await response.json();

        if (response.ok) {
          if (data.data.totalTickets >= MAX_TICKETS) {
            setMaxTicketsReached(true);
          }
        } else {
          console.error('Failed to fetch total tickets:', data.error);
        }
      } catch (error) {
        console.error('Error fetching total tickets:', error);
      }
    };

    checkTickets();
  }, []);

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
  useEffect(() => {
    const calculatePrices = async () => {
      try {
        // 1. (base price + block increase) * discount
        const ticketPrice = (TICKET.value + blockBatch * 10) * discountMultiple
        setTicketFiatPrice(ticketPrice)
  
        // 2. turn fiat price to sats
        const satsPerTicket = await convertCurrencyToSats(ticketPrice, TICKET.currency)
  
        // 3. calculate total price
        const totalSats = satsPerTicket * ticketQuantity
        setTotalPrice(totalSats)
      } catch (err: any) {
        console.error('Error calculando precios:', err)
      }
    }
  
    calculatePrices()
  }, [ticketQuantity, discountMultiple, blockBatch])

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
                            {ticketFiatPrice} {TICKET?.currency}
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
                      {TICKET?.type !== 'general' && (
                        <BlockBar totalSquares={5} filled={blockBatch} />
                      )}
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
                              {totalPrice}{' SAT'}
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
                      {/*<div className="p-4 mt-4">
                        <div className="flex gap-4 justify-between items-center">
                          <p className="text-text text-md">Total</p>
                          <div className="flex flex-col text-right">
                            <p className="font-bold text-md">
                              {discountMultiple === 1
                                ? (TICKET?.value + blockBatch * 10) * ticketQuantity
                                : Math.round(
                                    (TICKET?.value + blockBatch * 10) *
                                      ticketQuantity *
                                      discountMultiple
                                  )}{' '}
                              {TICKET.currency}
                            </p>
                            {discountMultiple !== 1 && (
                              <p className="font-semibold text-sm text-primary">
                                {((1 - discountMultiple) * 100).toFixed(0)}
                                {'% OFF'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>*/}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="hidden md:block ">
                  <Card className="p-4 bg-background opacity-95">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h2 className="text-md">{TICKET.title}</h2>
                        <p className="font-semibold text-lg">
                          {ticketFiatPrice} {TICKET?.currency}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
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

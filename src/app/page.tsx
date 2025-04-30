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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import useCode from '@/hooks/useCode';
import useOrder from '@/hooks/useOrder';
import { useNostr, useSubscription } from '@lawallet/react';
import { convertEvent } from '../lib/utils/nostr';
import { calculateTicketPrice } from '../lib/utils/price';
import { useRelay } from '@/hooks/useRelay';

// Mock data
const EVENT = {
  title: 'Bitcoin Pizza Day',
  subtitle: 'Conectá con la Comunidad Bitcoiner',
  date: '23 de Mayo - 19:00 hs',
  description: [
    'PANCHOS 🌭',
    'Entretenimiento',
    'Presentaciones',
    'Bitcoiners',
    'No sabes nada de Bitcoin pero te interesa? Vení!',
  ],
  imageUrl: 'https://placehold.co/400',
  value: parseInt(process.env.NEXT_TICKET_PRICE_ARS || '1'), // Updated ticket price
  valueType: 'ARS',
  tickets: [
    {
      id: 'entrada-base',
      title: 'Entrada Base',
      amount: 14.99,
      currency: 'USD',
    },
    {
      id: 'entrada-premium',
      title: 'Entrada Premium',
      amount: 39.99,
      currency: 'USD',
    },
  ],
};

const MAX_TICKETS = parseInt(process.env.NEXT_MAX_TICKETS || '0', 10); // Get the max tickets from env

export default function Page() {
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
  const [totalMiliSats, setTotalMiliSats] = useState<number>(0);
  const [ticketPriceSAT, setTicketPriceSAT] = useState<number>(EVENT.value);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1); // Set initial ticket quantity to 1
  const [paymentRequest, setPaymentRequest] = useState<string | undefined>(
    undefined
  );
  const [eventReferenceId, setEventReferenceId] = useState<string | undefined>(
    undefined
  );
  const [verifyUrl, setVerifyUrl] = useState<string | undefined>(undefined);
  const [maxTicketsReached, setMaxTicketsReached] = useState<boolean>(false);

  // New ticket type
  const [ticketSelected, setTicketSelected] = useState<string | null>(null);

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

      if (!ticketSelected) return;

      // Create new order
      try {
        const { pr, eventReferenceId, verify } = await requestNewOrder({
          ...data,
          ticketQuantity,
          code,
          ticketId: ticketSelected as string,
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
      ticketSelected,
    ]
  );

  // Process payment via nostr event
  const processPayment = useCallback(async () => {
    try {
      const event: Event = convertEvent(events[0]);

      if (!event) {
        console.warn('Event not defined ');
        return;
      }

      if (!userData) {
        console.warn('User data not defined ');
        return;
      }

      await claimOrderPayment(userData, event, ticketSelected as string);

      setUserData(undefined);
    } catch (error: any) {
      setOpenAlert(true);
      setAlertText(error.message);
    }
  }, [claimOrderPayment]);

  useEffect(() => {
    events && events.length && userData && processPayment();
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
  useEffect(() => {
    const calculatePrices = async () => {
      try {
        // Calculate discounted price in SAT
        const discountedPriceSAT = Math.round(EVENT.value * discountMultiple);
        setTicketPriceSAT(discountedPriceSAT);

        // Calculate total in ARS
        const totalMiliSats = Math.round(
          await calculateTicketPrice(ticketQuantity, discountedPriceSAT)
        );

        setTotalMiliSats(totalMiliSats);
      } catch (error: any) {
        console.error('Error calculating ticket prices:', error);
      }
    };

    calculatePrices();
  }, [ticketQuantity, discountMultiple]);

  // Change screen when payment is confirmed
  useEffect(() => {
    if (isPaid) {
      setScreen('summary');
    }
  }, [isPaid]);

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

  return (
    <>
      <div className="flex flex-col md:flex-row w-full min-h-[100dvh]">
        {/* Aside info */}
        <aside className="relative flex justify-center items-center w-full min-h-full pt-[60px] md:pt-0 bg-black">
          <Navbar />
          <div className="flex flex-col gap-2 w-full max-w-[520px] p-4">
            {screen === 'information' ? (
              <>
                <div className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <h1 className="text-2xl font-semibold leading-none tracking-tight">
                        {EVENT.title}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        {EVENT.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p>Villanueva 1367, CABA</p>
                      <p>{EVENT.date}</p>
                    </div>
                  </div>
                </div>
                <RadioGroup defaultValue={ticketSelected as string}>
                  {EVENT?.tickets?.map((ticket) => (
                    <>
                      <Label htmlFor={ticket?.title}>
                        <Card
                          className="flex justify-between p-4 cursor-pointer"
                          onClick={() => setTicketSelected(ticket?.id)}
                        >
                          <div className="flex flex-col justify-between">
                            <p>{ticket?.title}</p>
                            <p className="font-semibold text-lg">
                              {ticket?.amount} {ticket?.currency}
                            </p>
                            <p className="text-sm">Bloque: 1 / 5</p>
                          </div>

                          <div className="mt-1">
                            <RadioGroupItem
                              value={ticket?.title}
                              id={ticket?.title}
                            />
                          </div>
                        </Card>
                      </Label>
                    </>
                  ))}
                </RadioGroup>
                {/* {!maxTicketsReached && (
                  <>
                    <Card className="p-4 bg-black bg-opacity-85 mt-4">
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <p className="font-semibold text-lg">
                            <>
                              {discountMultiple !== 1 && (
                                <span className="line-through mr-2 text-text">
                                  {Math.round(
                                    ticketPriceSAT / discountMultiple
                                  )}
                                </span>
                              )}
                              {ticketPriceSAT} SAT
                            </>
                            {discountMultiple !== 1 && (
                              <span className="font-semibold text-sm text-primary">
                                {' '}
                                {((1 - discountMultiple) * 100).toFixed(0)}
                                {'% OFF'}
                              </span>
                            )}
                          </p>
                        </div>
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
                      </div>
                    </Card>
                    <Card className="bg-black bg-opacity-85">
                      <div className="p-4">
                        <div className="flex gap-4 justify-between items-center">
                          <p className="text-text">Total</p>
                          <div className="text-right">
                            <p className="font-bold text-md">
                              {totalMiliSats ? (
                                <>
                                  {discountMultiple !== 1 && (
                                    <span className="line-through mr-2 text-text">
                                      {Math.round(
                                        totalMiliSats / discountMultiple
                                      )}
                                    </span>
                                  )}
                                  {totalMiliSats} {EVENT.valueType}
                                </>
                              ) : (
                                'Calculating...'
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </>
                )} */}
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
                        <p className="font-bold text-lg no-underline">
                          {totalMiliSats
                            ? totalMiliSats + ' ' + EVENT.valueType
                            : 'Calculating...'}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Card className="p-4 bg-background">
                        <div className="flex justify-between items-center gap-4">
                          <div>
                            <h2 className="text-md">{EVENT.title}</h2>
                            <p className="font-semibold text-lg">
                              {ticketPriceSAT} SAT
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
                      <div className="p-4">
                        <div className="flex gap-4 justify-between items-center">
                          <p className="text-text text-md">Total</p>
                          <div className="text-right">
                            <p className="font-bold text-md">
                              {totalMiliSats
                                ? `${totalMiliSats} ${EVENT.valueType}`
                                : 'Calculating...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="hidden md:block ">
                  <Card className="p-4 bg-background">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h2 className="text-md">{EVENT.title}</h2>
                        <p className="font-semibold text-lg">
                          {ticketPriceSAT} SAT
                          {discountMultiple !== 1 && (
                            <span className="font-semibold text-sm text-primary">
                              {' '}
                              {((1 - discountMultiple) * 100).toFixed(0)}
                              {'% OFF'}
                            </span>
                          )}
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
                  <Card className="bg-background">
                    <div className="p-4">
                      <div className="flex gap-4 justify-between items-center">
                        <p className="text-text">Total</p>
                        <div className="text-right">
                          <p className="font-bold text-md">
                            <>
                              {discountMultiple !== 1 && (
                                <span className="line-through mr-2 text-text">
                                  {Math.round(totalMiliSats / discountMultiple)}
                                </span>
                              )}
                              {totalMiliSats} {EVENT.valueType}
                            </>
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
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
                ticketSelected={ticketSelected}
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

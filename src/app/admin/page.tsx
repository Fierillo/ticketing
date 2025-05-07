'use client';

import useSWR from 'swr';

import QrScanner from '@/components/scanner/Scanner';
import { createColumns, TicketInfo } from '@/components/table/columns';
import { DataTable } from '@/components/table/data-table';
import {
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { AlertDialog } from '@radix-ui/react-alert-dialog';
import {
  Ban,
  Blocks,
  CircleCheck,
  QrCode,
  QrCodeIcon,
  RefreshCcw,
} from 'lucide-react';
import { Event, EventTemplate, finalizeEvent, getPublicKey } from 'nostr-tools';
import NimiqQrScanner from 'qr-scanner';
import * as React from 'react';
import { useCallback, useState } from 'react';
import fetcher from '@/config/fetcher';

export default function AdminPage() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [privateKey, setPrivateKey] = useState('');
  // Table
  const [searchTerm, setSearchTerm] = useState('');
  // Scanner
  const [isOpenScanner, setIsOpenScanner] = useState(false);
  const [checkInResult, setCheckInResult] = useState<
    'checkedIn' | 'alreadyCheckedIn' | 'idle'
  >('idle');

  // SWR
  const { data, isLoading, mutate } = useSWR('/api/ticket/all', fetcher);

  // const handleLogin = async () => {
  //   try {
  //     if (!privateKey) {
  //       toast({
  //         title: 'Error',
  //         description: 'Private key is required',
  //         variant: 'destructive',
  //         duration: 3000,
  //       });
  //       return;
  //     }

  //     let publicKey;
  //     try {
  //       const privKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  //       publicKey = getPublicKey(privKey);
  //     } catch (error: any) {
  //       throw new Error('Invalid private key');
  //     }

  //     const response = await fetch('/api/admin/login', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ publicKey }),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(`${errorData.errors || response.statusText}`);
  //     }

  //     setIsAuthenticated(true);
  //     toast({
  //       title: 'Success',
  //       description: 'Logged in successfully',
  //       variant: 'default',
  //       duration: 3000,
  //     });
  //     fetchOrders();
  //   } catch (error: any) {
  //     toast({
  //       title: 'Error',
  //       description: error.message,
  //       variant: 'destructive',
  //       duration: 3000,
  //     });
  //   }
  // };

  const handleCheckIn = useCallback(
    async (ticketId: string) => {
      try {
        // TO-DO
        // Validate ADMIN KEY

        const response = await fetch('/api/ticket/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ticketId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || response.statusText);
        }

        const { data } = await response.json();

        alert(data?.alreadyCheckedIn);

        if (!data?.alreadyCheckedIn) {
          setCheckInResult('checkedIn');
          mutate();
        }

        setCheckInResult('alreadyCheckedIn');
      } catch (error: any) {
        console.error('Error:', error.message);
        toast({
          title: 'Error',
          description: `Failed to check in ticket ${ticketId}`,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }
    },
    [privateKey]
  );

  const handleEmailTicket = useCallback(
    async (ticketId: string) => {
      console.log('Email ticket', ticketId);

      try {
        const unsignedAuthEvent: EventTemplate = {
          kind: 27241,
          tags: [] as string[][],
          content: JSON.stringify({ ticket_id: ticketId }),
          created_at: Math.round(Date.now() / 1000),
        };

        const privKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
        const authEvent: Event = finalizeEvent(unsignedAuthEvent, privKey);

        const response = await fetch('/api/ticket/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ authEvent }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || response.statusText);
        }

        toast({
          title: 'Success',
          description: `Ticket ${ticketId} emailed successfully`,
          variant: 'default',
          duration: 5000,
        });
      } catch (error: any) {
        console.error('Error:', error.message);
        toast({
          title: 'Error',
          description: `Failed to check in ticket ${ticketId}`,
          variant: 'destructive',
          duration: 5000,
        });
      }
    },
    [privateKey]
  );

  const handleCheckInAlert = () => {
    setCheckInResult('idle');
  };

  // Scanner
  const openScanner = () => {
    setIsOpenScanner(true);
  };

  const closeScanner = () => {
    setIsOpenScanner(false);
  };

  const handleScanCheckIn = (result: NimiqQrScanner.ScanResult) => {
    if (!result || !result.data) return;

    handleCheckIn(result.data.trim());

    closeScanner();
  };

  const handleScanLogin = (result: NimiqQrScanner.ScanResult) => {
    if (!result || !result.data) return;

    setPrivateKey(result.data.trim());

    closeScanner();
  };

  const columns = React.useMemo(
    () => createColumns(handleCheckIn),
    [handleCheckIn]
  );

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto px-4 py-6">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Enter private key"
            />
            {/* <Button onClick={handleLogin} className="w-fit">
              Login
            </Button> */}
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={openScanner} className="w-full">
              <QrCodeIcon className="h-4 w-4 mr-2"></QrCodeIcon>
              Scan QR Code
            </Button>
            <Dialog open={isOpenScanner} onOpenChange={closeScanner}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Scan QR Code</DialogTitle>
                  <DialogDescription>
                    Position the QR code within the camera view to scan.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <QrScanner
                    className="w-full h-64 bg-black"
                    onDecode={handleScanLogin}
                    startOnLaunch={true}
                    highlightScanRegion={true}
                    highlightCodeOutline={true}
                    constraints={{
                      facingMode: 'environment',
                    }}
                    preferredCamera={'environment'}
                  />
                </div>
                <Button onClick={closeScanner} className="mt-4">
                  Cancel
                </Button>
              </DialogContent>
            </Dialog>
            {typeof window !== 'undefined' && window.webln && (
              <Button
                onClick={() => {
                  toast({
                    description: 'Not implemented yet',
                    duration: 3000,
                  });
                }}
                className="w-full"
              >
                <Blocks className="h-4 w-4 mr-2"></Blocks>
                Login with Extension
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>Manage and view ticket orders</CardDescription>
          <div className="flex space-x-2 mt-4">
            {/* <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            /> */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                openScanner();
              }}
            >
              <QrCode className="h-4 w-4 mr-2"></QrCode> Scan QR
            </Button>
            <Dialog open={isOpenScanner} onOpenChange={closeScanner}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Scan QR Code</DialogTitle>
                  <DialogDescription>
                    Position the QR code within the camera view to scan.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <QrScanner
                    className="w-full h-64 bg-black"
                    onDecode={handleScanCheckIn}
                    startOnLaunch={true}
                    highlightScanRegion={true}
                    highlightCodeOutline={true}
                    constraints={{
                      facingMode: 'environment',
                    }}
                    preferredCamera={'environment'}
                  />
                </div>
                <Button onClick={closeScanner} className="mt-4">
                  Cancel
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        {!isLoading && (
          <CardContent>
            <DataTable columns={columns} data={data?.data} />
          </CardContent>
        )}
        {!isLoading && (
          <CardFooter>
            <p>Total Orders: {data?.data?.length}</p>
          </CardFooter>
        )}
      </Card>
      {/* Checked In */}
      <AlertDialog open={checkInResult === 'checkedIn'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex">
              <CircleCheck className="mr-2"></CircleCheck> Success!
            </AlertDialogTitle>
            <AlertDialogDescription>Welcome to event!</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCheckInAlert}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Already Checked In */}
      <AlertDialog open={checkInResult === 'alreadyCheckedIn'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex">
              <Ban className="mr-2"></Ban>Failure!
            </AlertDialogTitle>
            <AlertDialogDescription>
              This ticket has already been checked in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCheckInAlert}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useCallback, useState, useMemo } from 'react';
import { Ban, CircleCheck, QrCode } from 'lucide-react';
import NimiqQrScanner from 'qr-scanner';
import useSWR from 'swr';
import { getPublicKey } from 'nostr-tools';
import { AlertDialog } from '@radix-ui/react-alert-dialog';

import { toast } from '@/hooks/use-toast';

import QrScanner from '@/components/scanner/Scanner';
import { createColumns } from '@/components/table/columns';
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

import fetcher from '@/config/fetcher';

export default function AdminPage() {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  // Table
  const [searchTerm, setSearchTerm] = useState('');
  // Scanner
  const [isOpenScanner, setIsOpenScanner] = useState(false);
  const [checkInResult, setCheckInResult] = useState<
    'checkedIn' | 'alreadyCheckedIn' | 'idle'
  >('idle');

  // SWR
  const { data, isLoading, mutate } = useSWR(
    isAuthenticated && '/api/ticket/all',
    fetcher,
    {
      refreshInterval: 200,
    }
  );

  const handleLogin = async () => {
    if (!privateKey) {
      toast({
        title: 'Error',
        description: 'Private key is required',
        variant: 'destructive',
        duration: 3000,
      });
      return;
    }

    let publicKey;

    const privKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));

    if (!privKey) {
      toast({
        title: 'Error',
        description: 'Invalid private key',
        variant: 'destructive',
        duration: 3000,
      });

      return;
    }

    publicKey = getPublicKey(privKey);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${errorData.errors || response.statusText}`);
      }

      setIsAuthenticated(true);
      toast({
        title: 'Success',
        description: 'Logged in successfully',
        variant: 'default',
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const handleCheckIn = useCallback(
    async (ticketId: string) => {
      try {
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
        mutate();

        if (data?.alreadyCheckedIn) {
          setCheckInResult('alreadyCheckedIn');
          return;
        }

        setCheckInResult('checkedIn');
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

  const columns = useMemo(() => createColumns(handleCheckIn), [handleCheckIn]);

  const filteredOrders = data?.data.filter(
    (order: any) =>
      order.User.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.User.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto mt-12">
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
            <Button onClick={handleLogin} className="w-fit">
              Login
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto px-4 py-6">
      <div className="flex flex-col gap-0">
        <h1 className="text-lg font-semibold">Tickets</h1>
        <p>Manage and view ticket orders</p>
      </div>

      <div className="flex space-x-2">
        <Input
          className="h-11"
          placeholder="Search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button
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

      {!isLoading && (
        <Card>
          <CardFooter className="p-4">
            <div className="w-full flex justify-between">
              <p className="text-sm">Total Orders</p>
              <p className="font-semibold">{data?.data?.length}</p>
            </div>
          </CardFooter>
        </Card>
      )}

      {!isLoading && <DataTable columns={columns} data={filteredOrders} />}

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

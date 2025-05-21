'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';

export type TicketInfo = {
  User: {
    fullname: string;
    email: string;
  };
  ticketId: string;
  checkIn: boolean;
};

export const createColumns = (
  handleCheckIn: (ticketId: string) => void
): ColumnDef<TicketInfo>[] => [
  {
    accessorKey: 'checkIn',
    header: ({ column }) => {
      return (
        <button
          className="flex items-center gap-2"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => (
      <div
        className={`w-4 h-4 rounded-full ${row.original.checkIn ? 'bg-primary' : 'bg-gray-800'}`}
      ></div>
    ),
  },
  {
    accessorKey: 'user',
    header: ({ column }) => {
      return (
        <button
          className="flex items-center gap-2"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          User
          <ArrowUpDown className="h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => (
      <div>
        <div>{row.original.User.fullname}</div>
        <div className="text-sm text-gray-500">{row.original.User.email}</div>
      </div>
    ),
    sortingFn: (a, b) => {
      const nameA = a.original.User.fullname.toLowerCase();
      const nameB = b.original.User.fullname.toLowerCase();

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      const emailA = a.original.User.email.toLowerCase();
      const emailB = b.original.User.email.toLowerCase();

      return emailA.localeCompare(emailB);
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {/* <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order.ticketId)}
            >
              Copy ticket ID
            </DropdownMenuItem> */}
            <DropdownMenuItem
              onClick={() => handleCheckIn(order.ticketId)}
              disabled={order.checkIn}
            >
              Check In
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

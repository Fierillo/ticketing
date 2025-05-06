import { createContext, useContext, useEffect, useState } from 'react';
import { checkTickets } from '@/lib/utils/tickets';
import { countTotalTickets } from '@/lib/utils/prisma';

export interface TicketCountContextType {
  maxTicketsReached: boolean;
  totalTickets: number | null;
}

export const TicketCountContext = createContext<TicketCountContextType>({
  maxTicketsReached: false,
  totalTickets: null,
});

const MAX_TICKETS = parseInt(process.env.NEXT_MAX_TICKETS || '0', 10); // Get the max tickets from env

export const TicketCountProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [maxTicketsReached, setMaxTicketsReached] = useState<boolean>(false);
  const [totalTickets, setTotalTickets] = useState<number | null>(null);

  useEffect(() => {
    // Initial check
    const checkTicketsStatus = async () => {
      console.info('Checking tickets status...');

      const totalTickets = await countTotalTickets();

      setMaxTicketsReached(totalTickets >= MAX_TICKETS);
      setTotalTickets(totalTickets);
    };

    // Run initial check
    checkTicketsStatus();

    // Set up interval to check every 5 seconds
    const intervalId = setInterval(checkTicketsStatus, 5000);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array since we don't need any dependencies

  return (
    <TicketCountContext.Provider value={{ maxTicketsReached, totalTickets }}>
      {children}
    </TicketCountContext.Provider>
  );
};

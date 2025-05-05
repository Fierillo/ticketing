import { useEffect, useState } from 'react';

interface UseTicketCountReturn {
  maxTicketsReached: boolean;
  totalTickets: number;
}

const MAX_TICKETS = parseInt(process.env.NEXT_MAX_TICKETS || '0', 10); // Get the max tickets from env

export function useTicketCount(): UseTicketCountReturn {
  const [maxTicketsReached, setMaxTicketsReached] = useState(false);
  const [totalTickets, setTotalTickets] = useState(0);

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
            setTotalTickets(data.data.totalTickets);
          }
        } else {
          console.error('Failed to fetch total tickets:', data.error);
        }
      } catch (error) {
        console.error('Error fetching total tickets:', error);
      }
    };

    // Initial check
    checkTickets();

    // Set up interval to check every 5 seconds
    const interval = setInterval(checkTickets, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  return { maxTicketsReached, totalTickets };
}

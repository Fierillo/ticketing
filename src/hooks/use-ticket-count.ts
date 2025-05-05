import {
  TicketCountContext,
  TicketCountContextType,
} from '@/context/ticket-count';
import { useContext } from 'react';

export function useTicketCount(): TicketCountContextType {
  const { maxTicketsReached, totalTickets } = useContext(TicketCountContext);
  return { maxTicketsReached, totalTickets };
}

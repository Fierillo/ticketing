const MAX_TICKETS = parseInt(process.env.NEXT_MAX_TICKETS || '0', 10); // Get the max tickets from env

export async function checkTickets(): Promise<{
  ticketsReached: boolean;
  totalTickets: number | null;
}> {
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

    return {
      ticketsReached: data.data.totalTickets >= MAX_TICKETS,
      totalTickets: data.data.totalTickets,
    };
  } catch (error) {
    console.error('Error fetching total tickets:', error);
  }
  return {
    ticketsReached: false,
    totalTickets: 0,
  };
}

// Module that calculate "BlockPrice" a number to update ticket prices in a epoch basis.

const BLOCK_INTERVAL = 21
const URL = process.env.NEXT_PUBLIC_API_URL

export interface BlockPriceStats {
  totalSold: number   // total de tickets vendidos
  blockValue: number  // cuántos bloques completos de 21 tickets
}

export async function blockPrice(): Promise<BlockPriceStats> {
  // 1. Calls API to get total ticket count.
  const res = await fetch(`${URL}/api/ticket/count`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.errors || res.statusText)
  }
  const {
    data: { totalTickets: totalSold },
  } = await res.json()

  // 2. Calculate block batch.
  const blockValue = Math.floor(totalSold / BLOCK_INTERVAL)

  return { totalSold, blockValue }
}
import axios from 'axios'

const YADIO_URL = 'https://api.yadio.io/exrates/'
const FETCH_INTERVAL = 60_000  // 1 minuto

type RateCacheEntry = {
  lastFetch: number
  rate: number
}

const rateCache: Record<string, RateCacheEntry> = {}

// Fetch BTC rate from Yadio
async function getBtcRate(currency: string): Promise<number> {
  const now = Date.now()
  const cache = rateCache[currency]

  if (cache && now - cache.lastFetch < FETCH_INTERVAL) {
    return cache.rate
  }

  try {
    const res = await axios.get(`${YADIO_URL}${currency}`)
    const rate = res.data?.BTC
    if (typeof rate !== 'number') {
      throw new Error(`Respuesta inválida de Yadio para ${currency}`)
    }
    rateCache[currency] = { lastFetch: now, rate }
    return rate
  } catch (err: any) {
    throw new Error(`No se pudo obtener la tasa BTC→${currency}: ${err.message}`)
  }
}

// Calculate price in desired currency
export async function convertSatsToCurrency(
  sats: number,
  currency: string
): Promise<number> {
  const rate = await getBtcRate(currency)
  const value = (sats * rate) / 100_000_000
  return Math.round(value * 100) / 100
}

// Calculate total price of tickets
export async function calculateTicketPrice(
  qty: number,
  ticketPriceSats: number,
  currency: string
): Promise<number> {
  const unitPrice = await convertSatsToCurrency(ticketPriceSats, currency)
  const total = unitPrice * qty
  return Math.round(total * 100) / 100
}

// Convert amount from desired currency to sats
export async function convertCurrencyToSats(
  amount: number,
  currency: string
): Promise<number> {
  const rate = await getBtcRate(currency)   // USD por BTC
  // amount USD * (1 BTC / rate USD) * 100 000 000 sats/BTC
  const sats = (amount / rate) * 100_000_000
  return Math.round(sats)
}
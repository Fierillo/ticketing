import { Event, EventTemplate, finalizeEvent, getEventHash, getPublicKey, nip19 } from 'nostr-tools';

// Nostr key handling
if (!process.env.NEXT_SIGNER_PRIVATE_KEY) {
  throw new Error('NEXT_NOSTR_PRIVATE_KEY environment variable is not set');
}

let decodedPrivateKey: Uint8Array;

if (/^[0-9a-fA-F]{64}$/.test(process.env.NEXT_SIGNER_PRIVATE_KEY)) {
  decodedPrivateKey = Uint8Array.from(Buffer.from(process.env.NEXT_SIGNER_PRIVATE_KEY, 'hex'));
} else {
  const decoded = nip19.decode(process.env.NEXT_SIGNER_PRIVATE_KEY);
  if (decoded.type !== 'nsec') {
    throw new Error('NEXT_NOSTR_PRIVATE_KEY must be a hex string or nsec');
  }
  decodedPrivateKey = decoded.data as Uint8Array; // nip19.decode ya devuelve un Uint8Array
}

const senderPublicKey = getPublicKey(decodedPrivateKey);

// Generate zap request
function generateZapRequest(orderId: string, amountSats: number, nostrPubkey: string): Event {
  const unsignedZapRequest: EventTemplate = {
    kind: 9734,
    tags: [
      ['p', nostrPubkey],
      ['amount', amountSats.toString()],
      ['relays', 'wss://relay.lawallet.ar', 'wss://nostr-pub.wellorder.net'],
      ['e', orderId],
    ] as string[][],
    content: '',
    created_at: Math.round(Date.now() / 1000),
  };

  const zapRequest: Event = finalizeEvent(unsignedZapRequest, decodedPrivateKey);
  return zapRequest;
}

// Transform event to standard format
function convertEvent(event: any): Event {
  return {
    tags: event.tags as string[][],
    content: event.content as string,
    created_at: event.created_at as number,
    pubkey: event.pubkey as string,
    id: event.id as string,
    kind: event.kind as number,
    sig: event.sig as string,
  };
}

export {
  convertEvent,
  generateZapRequest,
  senderPublicKey,
};
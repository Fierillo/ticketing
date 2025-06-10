export const EVENT = {
  title: 'Martes de Co-working',
  description: '¿Trabajas remoto y te aburrís como shitcoiner esperando altseason?',
  description2: '¡Venite a La Crypta!',
  location: 'Villanueva 1367, CABA',
  date: 'Todos los Martes de 12:00hs a 18:00hs',
  imageUrl: 'cowork.jpeg',
};

export const TICKET = JSON.parse(process.env.NEXT_PUBLIC_TICKET || '{}');

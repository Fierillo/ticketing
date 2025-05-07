export const EVENT = {
  title: 'Bitcoin Pizza Day',
  description: 'Conecta con la Comunidad Bitcoiner',
  date: 'Viernes 23 de Mayo - 19:00hs hasta las 02:00hs',
  location: 'Villanueva 1367, Belgrano, CABA',
  imageUrl: '',
  emailTitle: 'BITCOIN PIZZA DAY',
  emailSubject: 'Tu entrada para el Bitcoin Pizza Day',
};

export const TICKET = JSON.parse(process.env.NEXT_PUBLIC_TICKET || '{}');

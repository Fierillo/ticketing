export interface SESClientInterface {
  sendEmailOrder(
    email: string,
    orderId: string,
    type: string,
    serial?: number | undefined
  );
  sendEmailNewsletter(email: string);
}

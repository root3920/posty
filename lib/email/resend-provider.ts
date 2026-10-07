import { Resend } from 'resend';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './types';

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      react: params.react,
      text: params.text,
      replyTo: params.replyTo,
      headers: params.headers,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error('Resend: no se recibió ID del correo');
    }

    return { id: data.id };
  }
}

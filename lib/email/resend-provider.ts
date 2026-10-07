import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './types';

export class ResendProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    // Render React component to HTML ourselves — never delegate to Resend SDK
    // (Resend's `react:` param fails in Vercel serverless if the render
    // package isn't bundled correctly.)
    let html: string;
    try {
      html = await render(params.react);
    } catch (renderErr) {
      console.error('Error al renderizar plantilla de correo:', renderErr);
      throw new Error('No se pudo preparar el correo. Intenta de nuevo.');
    }

    const { data, error } = await this.client.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html,
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

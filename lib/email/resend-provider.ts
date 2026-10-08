import { Resend } from 'resend';
import { render } from '@react-email/render';
import type {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
  InboundEmail,
  InboundEmailAttachment,
} from './types';

export class ResendProvider implements EmailProvider {
  private client: Resend;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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

  /**
   * Fetch the full content of a received email from Resend.
   * Webhook payloads only include metadata — this fetches HTML, text, headers.
   */
  async fetchReceivedEmail(emailId: string): Promise<InboundEmail> {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Resend: error al obtener correo recibido (${res.status}): ${body}`,
      );
    }

    const data = await res.json();

    return {
      id: data.id,
      from: data.from,
      to: Array.isArray(data.to) ? data.to : [data.to],
      cc: data.cc ?? [],
      bcc: data.bcc ?? [],
      subject: data.subject ?? '(sin asunto)',
      text: data.text ?? null,
      html: data.html ?? null,
      headers: data.headers ?? {},
      message_id: data.message_id ?? '',
      reply_to: data.reply_to ?? [],
      attachments: (data.attachments ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => ({
          id: a.id,
          filename: a.filename ?? 'adjunto',
          size: a.size ?? 0,
          content_type: a.content_type ?? 'application/octet-stream',
          content_disposition: a.content_disposition ?? 'attachment',
          content_id: a.content_id ?? null,
          download_url: a.download_url ?? '',
          expires_at: a.expires_at ?? '',
        }),
      ),
    };
  }

  /**
   * Fetch attachment list with download URLs for a received email.
   */
  async fetchReceivedAttachments(
    emailId: string,
  ): Promise<InboundEmailAttachment[]> {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}/attachments`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Resend: error al obtener adjuntos (${res.status}): ${body}`,
      );
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.data ?? []).map((a: any) => ({
      id: a.id,
      filename: a.filename ?? 'adjunto',
      size: a.size ?? 0,
      content_type: a.content_type ?? 'application/octet-stream',
      content_disposition: a.content_disposition ?? 'attachment',
      content_id: a.content_id ?? null,
      download_url: a.download_url ?? '',
      expires_at: a.expires_at ?? '',
    }));
  }
}

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
      console.error('[Resend] Error al enviar correo:', error.message);
      throw new Error(translateResendError(error.message));
    }

    if (!data?.id) {
      console.error('[Resend] No se recibió ID del correo enviado');
      throw new Error('No se pudo enviar el correo. Intenta de nuevo.');
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

/**
 * Translate Resend API errors into user-friendly Spanish messages.
 * The raw English error is already logged before calling this.
 */
function translateResendError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('authentication')) {
    return 'No se pudo enviar el correo. Error de configuración del servidor.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Se alcanzó el límite de envío. Espera unos minutos e intenta de nuevo.';
  }
  if (lower.includes('domain') && lower.includes('not verified')) {
    return 'El dominio de correo no está verificado. Contacta al administrador.';
  }
  if (lower.includes('not found') || lower.includes('does not exist')) {
    return 'La dirección de correo no es válida o no existe.';
  }
  if (lower.includes('blocked') || lower.includes('suppressed')) {
    return 'El correo fue bloqueado. El destinatario puede estar en la lista de supresión.';
  }
  if (lower.includes('payload') || lower.includes('too large')) {
    return 'El correo es demasiado grande. Reduce el tamaño de los adjuntos.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'La dirección de correo del destinatario no es válida.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'El envío tardó demasiado. Intenta de nuevo.';
  }

  return 'No se pudo enviar el correo. Intenta de nuevo.';
}

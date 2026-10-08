import type { ReactElement } from 'react';

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  text: string;
  from: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

export type EmailStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'opened'
  | 'failed';

// --- Inbound email types ---

export interface InboundEmailAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  content_disposition: string;
  content_id: string | null;
  download_url: string;
  expires_at: string;
}

export interface InboundEmail {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  message_id: string;
  reply_to: string[];
  attachments: InboundEmailAttachment[];
}

export interface StoredAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  storage_path: string;
}

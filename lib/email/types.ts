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

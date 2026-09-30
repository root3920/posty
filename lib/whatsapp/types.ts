export type ConnectionStatus = 'open' | 'close' | 'connecting';

export interface WhatsAppProvider {
  createInstance(params: {
    instanceName: string;
    webhookUrl: string;
    webhookHeaders: Record<string, string>;
    events: string[];
  }): Promise<{ instanceName: string; token: string; qrBase64?: string }>;

  getQrCode(instanceName: string): Promise<{ base64: string; code?: string }>;

  getStatus(instanceName: string): Promise<{ state: ConnectionStatus }>;

  sendText(
    instanceName: string,
    number: string,
    text: string,
    delay?: number,
  ): Promise<{ messageId: string }>;

  markRead(
    instanceName: string,
    remoteJid: string,
    messageIds: string[],
  ): Promise<void>;

  disconnect(instanceName: string): Promise<void>;

  deleteInstance(instanceName: string): Promise<void>;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: Record<string, unknown>;
  sender?: string;
  date_time?: string;
  apikey?: string;
}

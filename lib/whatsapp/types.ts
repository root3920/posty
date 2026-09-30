export type ConnectionStatus = 'open' | 'close' | 'connecting';

export interface WhatsAppProvider {
  createInstance(params: {
    instanceName: string;
    webhookUrl: string;
    webhookHeaders: Record<string, string>;
    events: string[];
  }): Promise<{ instanceName: string; token: string; qrBase64?: string }>;

  getQrCode(instanceName: string): Promise<{ base64: string | null; code?: string; count?: number; pairingCode?: string | null }>;

  getStatus(instanceName: string): Promise<{ state: ConnectionStatus }>;

  fetchInstanceInfo(instanceName: string): Promise<InstanceInfo | null>;

  getWebhook(instanceName: string): Promise<WebhookConfig | null>;

  setWebhook(instanceName: string, config: WebhookConfig): Promise<void>;

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

export interface InstanceInfo {
  instanceName: string;
  state: ConnectionStatus;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  token?: string;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  events: string[];
  headers: Record<string, string>;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: Record<string, unknown>;
  sender?: string;
  date_time?: string;
  apikey?: string;
}

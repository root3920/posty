import type { ConnectionStatus, WhatsAppProvider } from './types';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Evolution API error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.text();
      if (body) message = `Evolution API error ${response.status}: ${body}`;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export class EvolutionProvider implements WhatsAppProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
      ...extra,
    };
  }

  async createInstance(params: {
    instanceName: string;
    webhookUrl: string;
    webhookHeaders: Record<string, string>;
    events: string[];
  }): Promise<{ instanceName: string; token: string; qrBase64?: string }> {
    const response = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        instanceName: params.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          enabled: true,
          url: params.webhookUrl,
          byEvents: false,
          base64: true,
          events: params.events,
          headers: params.webhookHeaders,
        },
      }),
    });

    const data = await handleResponse<{
      instance: { instanceName: string };
      hash: { apikey: string };
      qrcode?: { base64?: string };
    }>(response);

    return {
      instanceName: data.instance.instanceName,
      token: data.hash.apikey,
      qrBase64: data.qrcode?.base64,
    };
  }

  async getQrCode(instanceName: string): Promise<{ base64: string; code?: string }> {
    const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: this.headers(),
    });

    const data = await handleResponse<{ base64: string; code?: string }>(response);
    return { base64: data.base64, code: data.code };
  }

  async getStatus(instanceName: string): Promise<{ state: ConnectionStatus }> {
    const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: this.headers(),
    });

    const data = await handleResponse<{ instance: { state: ConnectionStatus } }>(response);
    return { state: data.instance.state };
  }

  async sendText(
    instanceName: string,
    number: string,
    text: string,
    delay?: number,
  ): Promise<{ messageId: string }> {
    const body: Record<string, unknown> = { number, text };
    if (delay !== undefined) body.delay = delay;

    const response = await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    const data = await handleResponse<{ key: { id: string } }>(response);
    return { messageId: data.key.id };
  }

  async markRead(
    instanceName: string,
    remoteJid: string,
    messageIds: string[],
  ): Promise<void> {
    const readMessages = messageIds.map((id) => ({
      remoteJid,
      fromMe: false,
      id,
    }));

    const response = await fetch(`${this.baseUrl}/chat/markMessageAsRead/${instanceName}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ readMessages }),
    });

    await handleResponse<unknown>(response);
  }

  async disconnect(instanceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: this.headers(),
    });

    await handleResponse<unknown>(response);
  }

  async deleteInstance(instanceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: this.headers(),
    });

    await handleResponse<unknown>(response);
  }
}

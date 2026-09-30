import type { ChatContact, ChatMessage, ConnectionStatus, InstanceInfo, WebhookConfig, WhatsAppProvider } from './types';

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
    // Normalize URL: ensure https:// prefix, strip trailing slash
    let url = baseUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    this.baseUrl = url.replace(/\/+$/, '');
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

  async getQrCode(instanceName: string): Promise<{ base64: string | null; code?: string; count?: number; pairingCode?: string | null }> {
    const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: this.headers(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await handleResponse<any>(response);
    console.log('[Evolution] getQrCode response keys:', Object.keys(data), 'count:', data.count);

    // /instance/connect returns { base64, code, count, pairingCode } at top level
    // /instance/create returns { qrcode: { base64, code } }
    const base64 = data.base64 ?? data.qrcode?.base64 ?? null;
    const code = data.code ?? data.qrcode?.code;

    return { base64, code, count: data.count, pairingCode: data.pairingCode };
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

  async fetchInstanceInfo(instanceName: string): Promise<InstanceInfo | null> {
    // Use connectionState for reliable state — fetchInstances can have stale data
    let state: ConnectionStatus = 'close';
    try {
      const stateRes = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: this.headers(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stateData = await handleResponse<any>(stateRes);
      state = (stateData?.instance?.state ?? stateData?.state ?? 'close') as ConnectionStatus;
      console.log('[Evolution] connectionState:', instanceName, '→', state);
    } catch (err) {
      console.error('[Evolution] connectionState failed:', err);
    }

    // Fetch instance details for owner/profile info
    let ownerJid: string | undefined;
    let profileName: string | undefined;
    let profilePicUrl: string | undefined;
    let token: string | undefined;

    try {
      const response = await fetch(`${this.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
        method: 'GET',
        headers: this.headers(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await handleResponse<any>(response);
      console.log('[Evolution] fetchInstances raw type:', typeof data, 'isArray:', Array.isArray(data));

      // Parse the response — could be array, single object, or nested
      const instances = Array.isArray(data) ? data : data ? [data] : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = instances.find((i: any) =>
        (i?.instance?.instanceName ?? i?.instanceName ?? i?.name) === instanceName
      ) ?? instances[0]; // fallback to first if only one

      if (inst) {
        // Try multiple possible paths for each field
        ownerJid = inst.instance?.ownerJid ?? inst.ownerJid;
        profileName = inst.instance?.profileName ?? inst.profileName;
        profilePicUrl = inst.instance?.profilePictureUrl ?? inst.instance?.profilePicUrl ?? inst.profilePicUrl;
        token = inst.instance?.token ?? inst.hash?.apikey ?? inst.token;
        // Some versions put state here too
        if (state === 'close') {
          const instState = inst.instance?.status ?? inst.instance?.state ?? inst.state;
          if (instState === 'open' || instState === 'connecting') state = instState as ConnectionStatus;
        }
        console.log('[Evolution] fetchInstances parsed:', { ownerJid, profileName, state, hasToken: !!token });
      }
    } catch (err) {
      console.error('[Evolution] fetchInstances failed:', err);
      // Not fatal — we already have the connection state
    }

    return {
      instanceName,
      state,
      ownerJid,
      profileName,
      profilePicUrl,
      token,
    };
  }

  async getWebhook(instanceName: string): Promise<WebhookConfig | null> {
    try {
      const response = await fetch(`${this.baseUrl}/webhook/find/${instanceName}`, {
        method: 'GET',
        headers: this.headers(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await handleResponse<any>(response);
      if (!data || (!data.url && !data.webhook?.url)) return null;

      const wh = data.webhook ?? data;
      return {
        enabled: wh.enabled ?? false,
        url: wh.url ?? '',
        events: wh.events ?? [],
        headers: wh.headers ?? {},
      };
    } catch {
      return null;
    }
  }

  async setWebhook(instanceName: string, config: WebhookConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        webhook: {
          enabled: config.enabled,
          url: config.url,
          byEvents: false,
          base64: true,
          events: config.events,
          headers: config.headers,
        },
      }),
    });
    await handleResponse<unknown>(response);
    console.log('[Evolution] setWebhook for', instanceName, '→', config.url);
  }

  async findChats(instanceName: string): Promise<ChatContact[]> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/findChats/${instanceName}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({}),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await handleResponse<any[]>(response);
      return (data ?? [])
        .filter((c) => c.id?.endsWith('@s.whatsapp.net')) // Only 1:1 chats, no groups
        .map((c) => ({
          remoteJid: c.id,
          pushName: c.name ?? c.pushName,
          profilePicUrl: c.profilePicUrl,
        }));
    } catch (err) {
      console.error('[Evolution] findChats failed:', err);
      return [];
    }
  }

  async findMessages(instanceName: string, remoteJid: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await handleResponse<any>(response);
      const messages = Array.isArray(data) ? data : data?.messages ?? [];
      return messages.map((m: ChatMessage) => ({
        key: m.key,
        pushName: m.pushName,
        message: m.message,
        messageType: m.messageType,
        messageTimestamp: m.messageTimestamp,
      }));
    } catch (err) {
      console.error('[Evolution] findMessages failed:', err);
      return [];
    }
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

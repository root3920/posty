const TRA_TOKEN_URL = 'https://pms.mincit.gov.co/token/';
const TRA_API_URL = 'https://traapi.mincit.gov.co/api/';
const TRA_API2_URL = 'https://traapi.mincit.gov.co/apitwo/';

interface TraConfig {
  rntNumber: string;
  apiToken?: string;
}

export class TraClient {
  private config: TraConfig;
  private token: string | null = null;

  constructor(config: TraConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    if (this.token) return this.token;
    // POST to token endpoint with RNT number
    const res = await fetch(TRA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rnt: this.config.rntNumber }),
    });
    if (!res.ok) throw new Error(`TRA token error: ${res.status}`);
    const data = await res.json();
    this.token = data.token ?? data.access_token;
    if (!this.token) throw new Error('No token returned from TRA API');
    return this.token;
  }

  async submitGuest(payload: Record<string, unknown>): Promise<{ traId: string }> {
    const token = await this.getToken();
    const res = await fetch(TRA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`TRA submission error: ${res.status} - ${body}`);
    }
    const data = await res.json();
    return { traId: data.id ?? data.tra_id ?? String(data) };
  }

  async submitCompanion(traId: string, companion: Record<string, unknown>): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(TRA_API2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...companion, tra_id: traId }),
    });
    if (!res.ok) {
      console.error('TRA companion error:', res.status);
    }
  }
}

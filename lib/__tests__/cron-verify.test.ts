import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCronRequest } from '../cron/verify';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/cron/test', {
    method: 'POST',
    headers,
  });
}

describe('verifyCronRequest', () => {
  const REAL_SECRET = 'abc123def456';

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', REAL_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null (pass) when secret matches', () => {
    const req = makeRequest({ Authorization: `Bearer ${REAL_SECRET}` });
    expect(verifyCronRequest(req)).toBeNull();
  });

  it('returns null with extra whitespace trimmed', () => {
    vi.stubEnv('CRON_SECRET', `  ${REAL_SECRET}  `);
    const req = makeRequest({ Authorization: `Bearer  ${REAL_SECRET}  ` });
    expect(verifyCronRequest(req)).toBeNull();
  });

  it('returns 401 when secret is wrong', async () => {
    const req = makeRequest({ Authorization: 'Bearer wrong_secret' });
    const res = verifyCronRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 401 when no Authorization header', async () => {
    const req = makeRequest({});
    const res = verifyCronRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 401 for non-Bearer auth', async () => {
    const req = makeRequest({ Authorization: `Basic ${REAL_SECRET}` });
    const res = verifyCronRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 500 when CRON_SECRET is not set', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const req = makeRequest({ Authorization: 'Bearer something' });
    const res = verifyCronRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
  });

  it('is case-insensitive on "Bearer" prefix', () => {
    const req = makeRequest({ Authorization: `bearer ${REAL_SECRET}` });
    expect(verifyCronRequest(req)).toBeNull();
  });

  it('rejects partial match (subset of real secret)', async () => {
    const req = makeRequest({ Authorization: `Bearer ${REAL_SECRET.slice(0, 6)}` });
    const res = verifyCronRequest(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});

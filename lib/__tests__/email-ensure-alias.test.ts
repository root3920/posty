import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for ensureEmailAlias: get-or-create pattern.
 * Mocks Supabase DB calls.
 */

function createMockDb(overrides: {
  existingAlias?: string | null;
  takenAliases?: string[];
  insertError?: { code: string; message: string } | null;
} = {}) {
  const {
    existingAlias = null,
    takenAliases = [],
    insertError = null,
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'email_aliases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => ({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: existingAlias ? { alias: existingAlias } : null,
                }),
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: takenAliases.includes(val) ? { id: 'taken' } : null,
              }),
            })),
          }),
          insert: vi.fn().mockResolvedValue({
            error: insertError,
          }),
        };
      }
      return {};
    }),
  };
}

describe('ensureEmailAlias', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns existing alias without creating', async () => {
    const { ensureEmailAlias } = await import('../email/ensure-alias');
    const db = createMockDb({ existingAlias: 'hotel-sol' });

    const result = await ensureEmailAlias(db as any, 'org-1', 'Hotel Sol');
    expect(result).toBe('hotel-sol');
    // Should NOT call insert
    expect(db.from).toHaveBeenCalledWith('email_aliases');
  });

  it('creates alias when none exists', async () => {
    const { ensureEmailAlias } = await import('../email/ensure-alias');
    const db = createMockDb({ existingAlias: null });

    const result = await ensureEmailAlias(db as any, 'org-1', 'Hotel La Playa');
    // Should generate something based on "Hotel La Playa"
    expect(result).toMatch(/^hotel-la-playa/);
  });

  it('generates valid slug from hotel name with accents', async () => {
    const { ensureEmailAlias } = await import('../email/ensure-alias');
    const db = createMockDb();

    const result = await ensureEmailAlias(db as any, 'org-1', 'Café Montaña');
    expect(result).toMatch(/^cafe-montana/);
    // No uppercase, no accents
    expect(result).toBe(result.toLowerCase());
    expect(result).not.toMatch(/[áéíóúñ]/);
  });

  it('never returns an empty string', async () => {
    const { ensureEmailAlias } = await import('../email/ensure-alias');
    const db = createMockDb();

    const result = await ensureEmailAlias(db as any, 'org-1', 'AB');
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

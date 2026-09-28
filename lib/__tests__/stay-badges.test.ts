import { describe, it, expect } from 'vitest';
import { getStayBadges, type StayBadgeInput } from '../stays/badges';

const TODAY = '2026-09-27';

function makeStay(overrides: Partial<StayBadgeInput>): StayBadgeInput {
  return {
    status: 'reserved',
    check_in_date: '2026-09-27',
    check_out_date: '2026-09-30',
    actual_check_in_at: null,
    actual_check_out_at: null,
    ...overrides,
  };
}

describe('getStayBadges — arrival badge', () => {
  it('reserved + entry today → "Llega hoy" info with confirm action', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved', check_in_date: TODAY }), TODAY);
    expect(badges.arrival?.label).toBe('Llega hoy');
    expect(badges.arrival?.variant).toBe('info');
    expect(badges.arrival?.action).toBe('confirm_arrival');
  });

  it('reserved + entry past → "Llegada pendiente" warning', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved', check_in_date: '2026-09-25' }), TODAY);
    expect(badges.arrival?.label).toBe('Llegada pendiente');
    expect(badges.arrival?.variant).toBe('warning');
    expect(badges.arrival?.action).toBe('confirm_arrival');
  });

  it('reserved + entry future > 3 days → no badge', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved', check_in_date: '2026-10-05' }), TODAY);
    expect(badges.arrival).toBeNull();
  });

  it('reserved + entry in 2 days → "En 2 días" info', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved', check_in_date: '2026-09-29' }), TODAY);
    expect(badges.arrival?.label).toBe('En 2 días');
    expect(badges.arrival?.variant).toBe('info');
    expect(badges.arrival?.action).toBeUndefined();
  });

  it('reserved + entry in 1 day → "En 1 día"', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved', check_in_date: '2026-09-28' }), TODAY);
    expect(badges.arrival?.label).toBe('En 1 día');
  });

  it('checked_in → "Check-in hecho" success with tooltip', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_in', actual_check_in_at: '2026-09-27T15:30:00Z' }),
      TODAY,
    );
    expect(badges.arrival?.label).toBe('Check-in hecho');
    expect(badges.arrival?.variant).toBe('success');
    expect(badges.arrival?.tooltip).toContain('Check-in:');
  });

  it('checked_out → "Check-in hecho" success', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_out', actual_check_in_at: '2026-09-27T15:30:00Z' }),
      TODAY,
    );
    expect(badges.arrival?.label).toBe('Check-in hecho');
    expect(badges.arrival?.variant).toBe('success');
  });

  it('no_show → "No-show" danger', () => {
    const badges = getStayBadges(makeStay({ status: 'no_show' }), TODAY);
    expect(badges.arrival?.label).toBe('No-show');
    expect(badges.arrival?.variant).toBe('danger');
  });

  it('cancelled → no arrival badge', () => {
    const badges = getStayBadges(makeStay({ status: 'cancelled' }), TODAY);
    expect(badges.arrival).toBeNull();
  });
});

describe('getStayBadges — departure badge', () => {
  it('checked_in + exit today → "Sale hoy" info with register action', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_in', check_out_date: TODAY }),
      TODAY,
    );
    expect(badges.departure?.label).toBe('Sale hoy');
    expect(badges.departure?.variant).toBe('info');
    expect(badges.departure?.action).toBe('register_checkout');
  });

  it('checked_in + exit past → "Salida pendiente" danger', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_in', check_out_date: '2026-09-25' }),
      TODAY,
    );
    expect(badges.departure?.label).toBe('Salida pendiente');
    expect(badges.departure?.variant).toBe('danger');
    expect(badges.departure?.action).toBe('register_checkout');
  });

  it('checked_in + exit future → no departure badge', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_in', check_out_date: '2026-09-30' }),
      TODAY,
    );
    expect(badges.departure).toBeNull();
  });

  it('checked_out → "Check-out hecho" success', () => {
    const badges = getStayBadges(
      makeStay({ status: 'checked_out', actual_check_out_at: '2026-09-27T12:00:00Z' }),
      TODAY,
    );
    expect(badges.departure?.label).toBe('Check-out hecho');
    expect(badges.departure?.variant).toBe('success');
    expect(badges.departure?.tooltip).toContain('Check-out:');
  });

  it('reserved → no departure badge', () => {
    const badges = getStayBadges(makeStay({ status: 'reserved' }), TODAY);
    expect(badges.departure).toBeNull();
  });
});

describe('getStayBadges — status column', () => {
  it.each([
    ['reserved', 'Reservada', 'info', false],
    ['checked_in', 'Hospedado', 'success', false],
    ['checked_out', 'Salió', 'muted', false],
    ['cancelled', 'Cancelada', 'neutral', true],
    ['no_show', 'No-show', 'danger', false],
  ] as const)('%s → label "%s", variant "%s", dimmed=%s', (status, label, variant, dimmed) => {
    const badges = getStayBadges(makeStay({ status }), TODAY);
    expect(badges.status.label).toBe(label);
    expect(badges.status.variant).toBe(variant);
    expect(badges.status.dimmed).toBe(dimmed);
  });
});

describe('getStayBadges — midnight timezone edge cases', () => {
  it('entry date matches today exactly at midnight boundary', () => {
    // This tests that we compare date strings, not Date objects
    const badges = getStayBadges(
      makeStay({ status: 'reserved', check_in_date: '2026-09-27' }),
      '2026-09-27', // same day
    );
    expect(badges.arrival?.label).toBe('Llega hoy');
  });

  it('entry date is "yesterday" in org timezone', () => {
    // If org is in America/Bogota and it's Sep 27 00:30 local,
    // today = "2026-09-27", a check_in of "2026-09-26" is past
    const badges = getStayBadges(
      makeStay({ status: 'reserved', check_in_date: '2026-09-26' }),
      '2026-09-27',
    );
    expect(badges.arrival?.label).toBe('Llegada pendiente');
    expect(badges.arrival?.variant).toBe('warning');
  });
});

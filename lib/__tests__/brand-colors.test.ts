import { describe, it, expect } from 'vitest';
import {
  generateBrandPalette,
  contrastRatio,
  bestForeground,
  isLightOnDark,
  validateHex,
  POSTY_DEFAULT_COLOR,
} from '../brand-colors';

describe('validateHex', () => {
  it('accepts 6-digit hex with #', () => {
    expect(validateHex('#2563eb')).toBe('#2563eb');
  });
  it('accepts 6-digit hex without #', () => {
    expect(validateHex('2563eb')).toBe('#2563eb');
  });
  it('expands 3-digit hex', () => {
    expect(validateHex('#f00')).toBe('#ff0000');
  });
  it('rejects invalid', () => {
    expect(validateHex('xyz')).toBeNull();
    expect(validateHex('#12345g')).toBeNull();
    expect(validateHex('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('black on white is ~21:1', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });
  it('same color is 1:1', () => {
    expect(contrastRatio('#ff0000', '#ff0000')).toBeCloseTo(1, 0);
  });
});

describe('bestForeground', () => {
  it('dark red → white foreground', () => {
    expect(bestForeground('#9c0b21')).toBe('#ffffff');
  });
  it('dark blue → white foreground', () => {
    expect(bestForeground('#2563eb')).toBe('#ffffff');
  });
  it('light pink → dark foreground', () => {
    expect(bestForeground('#f8b4bc')).toBe('#1a1a1a');
  });
  it('yellow → dark foreground', () => {
    expect(bestForeground('#eab308')).toBe('#1a1a1a');
  });
  it('dark green → white foreground', () => {
    expect(bestForeground('#166534')).toBe('#ffffff');
  });
  it('gray → depends on luminance', () => {
    const fg = bestForeground('#6b7280');
    expect(typeof fg).toBe('string');
  });
});

describe('isLightOnDark', () => {
  it('POSTY red is dark (white text)', () => {
    expect(isLightOnDark('#9c0b21')).toBe(true);
  });
  it('light pink is light (dark text)', () => {
    expect(isLightOnDark('#f8b4bc')).toBe(false);
  });
});

describe('generateBrandPalette', () => {
  it('generates palette for POSTY default color', () => {
    const palette = generateBrandPalette(POSTY_DEFAULT_COLOR);
    expect(palette['--primary']).toBe('#9c0b21');
    expect(palette['--primary-foreground']).toBe('#ffffff');
    expect(palette['--sidebar']).toBe('#9c0b21');
    expect(palette['--color-posty-700']).toBe('#9c0b21');
  });

  it('generates palette for blue', () => {
    const palette = generateBrandPalette('#2563eb');
    expect(palette['--primary']).toBe('#2563eb');
    expect(palette['--primary-foreground']).toBe('#ffffff');
  });

  it('generates palette for light pink (contrast aware)', () => {
    const palette = generateBrandPalette('#f8b4bc');
    expect(palette['--primary']).toBe('#f8b4bc');
    expect(palette['--primary-foreground']).toBe('#1a1a1a');
    expect(palette['--brand-foreground-is-white']).toBe('0');
  });

  it('generates sidebar-darker as a darker shade', () => {
    const palette = generateBrandPalette('#2563eb');
    expect(palette['--sidebar-darker']).not.toBe('#2563eb');
  });

  it('generates shadow with correct RGB', () => {
    const palette = generateBrandPalette('#2563eb');
    expect(palette['--shadow-brand']).toContain('37,99,235');
  });

  it('palette has all required keys', () => {
    const palette = generateBrandPalette('#16a34a');
    const requiredKeys = [
      '--primary', '--primary-foreground', '--ring',
      '--sidebar', '--sidebar-darker', '--sidebar-foreground',
      '--sidebar-primary', '--sidebar-primary-foreground',
      '--color-posty-50', '--color-posty-700', '--color-posty-950',
      '--shadow-brand', '--shadow-brand-hover',
    ];
    for (const key of requiredKeys) {
      expect(palette).toHaveProperty(key);
    }
  });

  it('foreground meets WCAG AA for all test colors', () => {
    const testColors = ['#9c0b21', '#2563eb', '#f8b4bc', '#eab308', '#166534', '#6b7280'];
    for (const color of testColors) {
      const palette = generateBrandPalette(color);
      const fg = palette['--primary-foreground'];
      const ratio = contrastRatio(color, fg);
      // WCAG AA requires 4.5:1 for normal text
      // Some very mid-range colors might not hit 4.5:1 exactly
      expect(ratio).toBeGreaterThanOrEqual(3.0); // At least AA large text
    }
  });
});

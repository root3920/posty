/**
 * Brand color palette generation.
 *
 * Given a hex color, generates CSS custom properties for the full brand palette.
 * Uses simple HSL manipulation (no external dependencies).
 * Calculates foreground color for WCAG AA contrast (4.5:1).
 */

// -------------------------------------------------------
// Hex ↔ RGB ↔ HSL conversions
// -------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h / 360 + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h / 360) * 255),
    Math.round(hue2rgb(p, q, h / 360 - 1 / 3) * 255),
  ];
}

// -------------------------------------------------------
// Contrast calculation (WCAG 2.1)
// -------------------------------------------------------

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(...hexToRgb(hex1));
  const l2 = relativeLuminance(...hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns '#ffffff' or '#000000' for best contrast against the given color. */
export function bestForeground(hex: string): '#ffffff' | '#1a1a1a' {
  const whiteContrast = contrastRatio(hex, '#ffffff');
  const darkContrast = contrastRatio(hex, '#1a1a1a');
  return whiteContrast >= 4.5 ? '#ffffff' : darkContrast >= 4.5 ? '#1a1a1a' : (whiteContrast > darkContrast ? '#ffffff' : '#1a1a1a');
}

/** Whether white text has enough contrast on this background. */
export function isLightOnDark(hex: string): boolean {
  return bestForeground(hex) === '#ffffff';
}

// -------------------------------------------------------
// Palette generation
// -------------------------------------------------------

function darken(hex: string, amount: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return rgbToHex(...hslToRgb(h, s, Math.max(0, l - amount)));
}

/**
 * Generate the complete brand CSS variables from a single hex color.
 * These override the defaults in globals.css.
 */
export function generateBrandPalette(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  const fg = bestForeground(hex);
  const fgIsWhite = fg === '#ffffff';
  const darker = darken(hex, 0.08);

  // Generate shade scale (50=very light → 950=very dark)
  const [h, s] = rgbToHsl(r, g, b);
  const shade = (targetL: number) => rgbToHex(...hslToRgb(h, Math.min(s, 0.9), targetL));

  return {
    // Primary (buttons, links, active states)
    '--primary': hex,
    '--primary-foreground': fg,
    '--ring': shade(0.55),

    // Sidebar
    '--sidebar': hex,
    '--sidebar-darker': darker,
    '--sidebar-foreground': fgIsWhite ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.75)',
    '--sidebar-primary': fgIsWhite ? '#ffffff' : '#0f0c0d',
    '--sidebar-primary-foreground': hex,
    '--sidebar-border': fgIsWhite ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    '--sidebar-hover': fgIsWhite ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',

    // Brand scale (for bg-primary/5, etc.)
    '--color-posty-50': shade(0.96),
    '--color-posty-100': shade(0.92),
    '--color-posty-200': shade(0.84),
    '--color-posty-300': shade(0.72),
    '--color-posty-400': shade(0.58),
    '--color-posty-500': shade(0.46),
    '--color-posty-600': shade(0.38),
    '--color-posty-700': hex,
    '--color-posty-800': shade(0.24),
    '--color-posty-900': shade(0.18),
    '--color-posty-950': shade(0.10),

    // Shadow
    '--shadow-brand': `0 4px 14px rgba(${r},${g},${b},0.25)`,
    '--shadow-brand-hover': `0 6px 20px rgba(${r},${g},${b},0.35)`,

    // Metadata
    '--brand-foreground-is-white': fgIsWhite ? '1' : '0',
  };
}

/** The default POSTY brand color. */
export const POSTY_DEFAULT_COLOR = '#9c0b21';

/** Validate a hex color string. Returns the normalized 6-digit hex or null. */
export function validateHex(input: string): string | null {
  let hex = input.trim().replace(/^#/, '');
  // Allow 3-digit shorthand
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return '#' + hex.toLowerCase();
}

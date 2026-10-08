import { describe, it, expect } from 'vitest';
import {
  splitPlainTextQuote,
  extractPreviewText,
  htmlHasQuotedContent,
} from '../email/quote-utils';

describe('splitPlainTextQuote', () => {
  it('detects Gmail-style "On ... wrote:" quote', () => {
    const text = `Hola, confirmo mi reserva para el viernes.

Gracias,
María

On Thu, Oct 8, 2026 at 10:30 AM Hotel Sol <hotel@example.com> wrote:
> Estimada María,
> Su reserva está confirmada.`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toContain('confirmo mi reserva');
    expect(newText).toContain('María');
    expect(newText).not.toContain('wrote:');
    expect(quotedText).toContain('wrote:');
    expect(quotedText).toContain('Estimada María');
  });

  it('detects Spanish "El ... escribió:" quote', () => {
    const text = `Sí, llego a las 3pm.

El jue, 8 oct 2026 a las 10:30, Hotel Sol <hotel@example.com> escribió:
> Hola, ¿a qué hora llega?`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toContain('llego a las 3pm');
    expect(newText).not.toContain('escribió');
    expect(quotedText).toContain('escribió');
  });

  it('detects Outlook "From: ... Sent:" quote', () => {
    const text = `Perfecto, gracias.

From: Hotel Sol
Sent: Thursday, October 8, 2026
To: guest@gmail.com
Subject: Confirmación

Estimado huésped...`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('Perfecto, gracias.');
    expect(quotedText).toContain('From: Hotel Sol');
  });

  it('detects "-----Original Message-----"', () => {
    const text = `OK, entendido.

-----Original Message-----
De: Hotel Sol
Para: guest@outlook.com`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('OK, entendido.');
    expect(quotedText).toContain('Original Message');
  });

  it('returns full text when no quote detected', () => {
    const text = 'Hola, quisiera reservar una habitación para el próximo fin de semana.';
    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe(text);
    expect(quotedText).toBeNull();
  });

  it('handles empty text', () => {
    const { newText, quotedText } = splitPlainTextQuote('');
    expect(newText).toBe('');
    expect(quotedText).toBeNull();
  });
});

describe('extractPreviewText', () => {
  it('extracts only new text from plain text with quote', () => {
    const bodyText = `Llego mañana a las 3.

On Oct 8, 2026, Hotel wrote:
> Confirmamos su reserva.`;

    const preview = extractPreviewText(bodyText, null);
    expect(preview).toContain('Llego mañana');
    expect(preview).not.toContain('Confirmamos');
  });

  it('strips HTML tags and blockquotes from HTML', () => {
    const html = `<p>Gracias por la información.</p>
<div class="gmail_quote"><blockquote>Texto citado</blockquote></div>`;

    const preview = extractPreviewText(null, html);
    expect(preview).toContain('Gracias por la información');
    expect(preview).not.toContain('Texto citado');
  });

  it('returns empty string for null inputs', () => {
    expect(extractPreviewText(null, null)).toBe('');
  });

  it('truncates long previews', () => {
    const longText = 'A'.repeat(200);
    const preview = extractPreviewText(longText, null);
    expect(preview.length).toBeLessThanOrEqual(120);
  });
});

describe('htmlHasQuotedContent', () => {
  it('detects gmail_quote class', () => {
    expect(htmlHasQuotedContent('<div class="gmail_quote">quoted</div>')).toBe(true);
  });

  it('detects blockquote type="cite"', () => {
    expect(htmlHasQuotedContent('<blockquote type="cite">quoted</blockquote>')).toBe(true);
  });

  it('detects divRplyFwdMsg', () => {
    expect(htmlHasQuotedContent('<div id="divRplyFwdMsg">Outlook reply</div>')).toBe(true);
  });

  it('detects plain blockquote', () => {
    expect(htmlHasQuotedContent('<blockquote>some quote</blockquote>')).toBe(true);
  });

  it('returns false for plain HTML', () => {
    expect(htmlHasQuotedContent('<p>Just a paragraph</p>')).toBe(false);
  });
});

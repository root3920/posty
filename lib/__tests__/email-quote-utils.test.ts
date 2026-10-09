import { describe, it, expect } from 'vitest';
import {
  splitPlainTextQuote,
  extractPreviewText,
  extractNewContent,
  htmlHasQuotedContent,
  stripHtmlQuotes,
  visiblePartHasBlockedImages,
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
    expect(newText).not.toContain('wrote:');
    expect(quotedText).toContain('wrote:');
  });

  it('detects Spanish "El ... escribió:" quote', () => {
    const text = `Sí, llego a las 3pm.

El jue, 8 oct 2026 a las 10:30, Hotel Sol <hotel@example.com> escribió:
> Hola, ¿a qué hora llega?`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toContain('llego a las 3pm');
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
De: Hotel Sol`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('OK, entendido.');
    expect(quotedText).toContain('Original Message');
  });

  it('detects > quoting after non-quoted content', () => {
    const text = `Gracias por confirmar.

> Su reserva está lista.
> Check-in a las 15:00.`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('Gracias por confirmar.');
    expect(quotedText).toContain('> Su reserva');
  });

  it('does NOT split when > is the only content (no new text before)', () => {
    const text = `> Quoted line 1
> Quoted line 2`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe(text);
    expect(quotedText).toBeNull();
  });

  it('returns full text when no quote detected', () => {
    const text = 'Hola, quisiera reservar una habitación.';
    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe(text);
    expect(quotedText).toBeNull();
  });

  it('handles empty text', () => {
    const { newText, quotedText } = splitPlainTextQuote('');
    expect(newText).toBe('');
    expect(quotedText).toBeNull();
  });

  it('detects Outlook long underscore divider', () => {
    const text = `Listo, reservo.

________________________________
De: Hotel Sol
Enviado: jueves, 8 de octubre`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('Listo, reservo.');
    expect(quotedText).toBeTruthy();
  });

  it('detects "-- " signature delimiter', () => {
    const text = `Confirmo la reserva.

--
María García
CEO, Acme Corp`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('Confirmo la reserva.');
    expect(quotedText).toContain('María García');
  });

  it('detects "Enviado desde mi iPhone"', () => {
    const text = `Ok gracias

Enviado desde mi iPhone`;

    const { newText, quotedText } = splitPlainTextQuote(text);
    expect(newText).toBe('Ok gracias');
    expect(quotedText).toContain('Enviado desde mi iPhone');
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

  it('strips URLs from preview', () => {
    const text = 'Mira esto https://example.com/very/long/url aquí';
    const preview = extractPreviewText(text, null);
    expect(preview).not.toContain('https://');
    expect(preview).toContain('Mira esto');
  });

  it('returns "[Imagen]" when HTML has only images', () => {
    const html = '<img src="data:..." alt="foto" />';
    const preview = extractPreviewText(null, html);
    expect(preview).toBe('[Imagen]');
  });

  it('returns "(Sin contenido)" for null inputs', () => {
    expect(extractPreviewText(null, null)).toBe('(Sin contenido)');
  });

  it('truncates to ~140 chars', () => {
    const longText = 'A'.repeat(200);
    const preview = extractPreviewText(longText, null);
    expect(preview.length).toBeLessThanOrEqual(140);
  });
});

describe('extractNewContent', () => {
  it('extracts new text from plain text reply', () => {
    const bodyText = `Perfecto, llego mañana.

On Oct 8, 2026, Hotel wrote:
> Confirmamos su reserva.`;

    const { text, hasQuoted } = extractNewContent(bodyText, null);
    expect(text).toContain('Perfecto, llego mañana');
    expect(text).not.toContain('wrote:');
    expect(hasQuoted).toBe(true);
  });

  it('returns full text when stripping quotes leaves nothing', () => {
    // Edge case: the "new" part is empty — should show full content
    const html = '<div class="gmail_quote"><p>Solo hay cita</p></div>';
    const { text, hasQuoted } = extractNewContent(null, html);
    expect(text.length).toBeGreaterThan(0); // Should NOT be empty
    expect(text).toContain('Solo hay cita');
  });

  it('handles plain text without quotes', () => {
    const { text, hasQuoted } = extractNewContent('Hola mundo', null);
    expect(text).toBe('Hola mundo');
    expect(hasQuoted).toBe(false);
  });
});

describe('htmlHasQuotedContent', () => {
  it('detects gmail_quote', () => expect(htmlHasQuotedContent('<div class="gmail_quote">q</div>')).toBe(true));
  it('detects blockquote type="cite"', () => expect(htmlHasQuotedContent('<blockquote type="cite">q</blockquote>')).toBe(true));
  it('detects divRplyFwdMsg', () => expect(htmlHasQuotedContent('<div id="divRplyFwdMsg">q</div>')).toBe(true));
  it('returns false for plain HTML', () => expect(htmlHasQuotedContent('<p>Just text</p>')).toBe(false));
});

describe('stripHtmlQuotes', () => {
  it('removes gmail_quote div and everything after', () => {
    const html = '<p>New content</p><div class="gmail_quote"><p>Quoted</p></div>';
    const result = stripHtmlQuotes(html);
    expect(result).toContain('New content');
    expect(result).not.toContain('Quoted');
  });

  it('removes Apple Mail blockquote type=cite', () => {
    const html = '<p>Reply</p><blockquote type="cite"><p>Original</p></blockquote>';
    const result = stripHtmlQuotes(html);
    expect(result).toContain('Reply');
    expect(result).not.toContain('Original');
  });

  it('preserves content when no quotes', () => {
    const html = '<p>Just a paragraph</p>';
    expect(stripHtmlQuotes(html)).toBe(html);
  });
});

describe('visiblePartHasBlockedImages', () => {
  it('detects blocked images in visible part', () => {
    const html = '<img data-original-src="https://example.com/img.png" />';
    expect(visiblePartHasBlockedImages(html)).toBe(true);
  });

  it('ignores blocked images inside gmail_quote', () => {
    const html = '<p>Text</p><div class="gmail_quote"><img data-original-src="https://example.com/img.png" /></div>';
    expect(visiblePartHasBlockedImages(html)).toBe(false);
  });
});

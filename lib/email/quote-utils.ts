/**
 * Utilities for detecting and splitting quoted content in email replies.
 *
 * Detects:
 * - "On <date>... wrote:" / "El <date>... escribió:" patterns
 * - <blockquote> elements
 * - Gmail/Outlook/Apple Mail signature dividers
 * - "-----Original Message-----" / "De: ... Enviado: ..."
 */

// ─── Plain text quote detection ─────────────────────────────────────────

/**
 * Patterns that indicate the start of quoted text in plain text emails.
 * Everything from the first match onward is considered quoted.
 * Ordered from most specific to least specific to avoid false positives.
 */
const QUOTE_START_PATTERNS: RegExp[] = [
  // Gmail / generic: "On Oct 8, 2026 at 10:30 AM ... wrote:"
  /^On .{10,120} wrote:\s*$/m,
  // Gmail Spanish: "El jue, 8 oct 2026 a las 10:30, ... escribió:"
  /^El .{10,120} escribi[oó]:\s*$/m,
  // French: "Le jeu, 8 oct ... a écrit :"
  /^Le .{10,120} a [eé]crit\s?:\s*$/m,
  // German: "Am 8. Okt ... schrieb ...:"
  /^Am .{10,120} schrieb.*:\s*$/m,
  // Outlook English: "From: ... Sent: ..."
  /^From:\s.+\r?\nSent:\s/m,
  // Outlook Spanish: "De: ... Enviado: ..."
  /^De:\s.+\r?\nEnviado:\s/m,
  // "-----Original Message-----"
  /^-{3,}\s*Original Message\s*-{3,}/mi,
  /^-{3,}\s*Mensaje original\s*-{3,}/mi,
  // Outlook long underscore divider: "________________________________"
  /^_{10,}\s*$/m,
];

/**
 * Signature patterns — only match if preceded by new content.
 */
const SIGNATURE_PATTERNS: RegExp[] = [
  // "-- " or "--" (standard sig delimiter, RFC 3676 — some clients drop the trailing space)
  /^-- ?\r?\n/m,
  // "Enviado desde mi iPhone" / "Sent from my iPhone"
  /^(?:Enviado desde|Sent from) (?:mi |my )/mi,
];

/**
 * Split plain text into [newContent, quotedContent].
 * If after stripping nothing remains, returns the full text.
 */
export function splitPlainTextQuote(text: string): { newText: string; quotedText: string | null } {
  // Find the EARLIEST match across all patterns
  let bestIndex = -1;

  for (const pattern of [...QUOTE_START_PATTERNS, ...SIGNATURE_PATTERNS]) {
    const match = pattern.exec(text);
    if (match && match.index !== undefined && match.index > 0) {
      if (bestIndex === -1 || match.index < bestIndex) {
        bestIndex = match.index;
      }
    }
  }

  if (bestIndex > 0) {
    const newText = text.slice(0, bestIndex).trimEnd();
    if (newText.length > 0) {
      return { newText, quotedText: text.slice(bestIndex) };
    }
  }

  // Try ">" quoting — only if there are non-quoted lines before the quoted block
  const lines = text.split('\n');
  let firstQuotedLine = -1;
  let hasNonQuotedBefore = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (line.startsWith('>')) {
      if (hasNonQuotedBefore && firstQuotedLine === -1) {
        firstQuotedLine = i;
      }
    } else if (line.length > 0) {
      hasNonQuotedBefore = true;
    }
  }
  if (firstQuotedLine > 0) {
    const newText = lines.slice(0, firstQuotedLine).join('\n').trimEnd();
    if (newText.length > 0) {
      return { newText, quotedText: lines.slice(firstQuotedLine).join('\n') };
    }
  }

  return { newText: text, quotedText: null };
}

// ─── HTML quote stripping ───────────────────────────────────────────────

/**
 * Remove quoted sections from HTML, returning only the new content.
 * Used for preview extraction and text-mode display.
 */
export function stripHtmlQuotes(html: string): string {
  return html
    // Gmail quote div (everything from it onward is quoted)
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*$/i, '')
    // Gmail signature
    .replace(/<div[^>]*class="[^"]*gmail_signature[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Outlook reply header
    .replace(/<div[^>]*id\s*=\s*["']divRplyFwdMsg["'][^>]*>[\s\S]*$/i, '')
    // Apple Mail blockquote type="cite"
    .replace(/<blockquote[^>]*type\s*=\s*["']cite["'][^>]*>[\s\S]*?<\/blockquote>/gi, '')
    // Generic trailing blockquotes
    .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>\s*$/gi, '');
}

// ─── HTML quote detection ───────────────────────────────────────────────

/**
 * CSS to hide quoted content in HTML emails displayed in an iframe.
 */
export const QUOTE_HIDE_CSS = `
.gmail_quote, .gmail_signature,
[class*="gmail_quote"], [class*="gmail_signature"] { display: none; }
#divRplyFwdMsg, div[id="divRplyFwdMsg"],
.MsoNormal blockquote { display: none; }
blockquote[type="cite"] { display: none; }
body > blockquote:last-of-type { display: none; }
.posty-show-quoted .gmail_quote,
.posty-show-quoted .gmail_signature,
.posty-show-quoted [class*="gmail_quote"],
.posty-show-quoted [class*="gmail_signature"],
.posty-show-quoted #divRplyFwdMsg,
.posty-show-quoted .MsoNormal blockquote,
.posty-show-quoted div[id="divRplyFwdMsg"],
.posty-show-quoted blockquote[type="cite"],
.posty-show-quoted body > blockquote:last-of-type {
  display: block !important;
  opacity: 0.6;
  border-left: 3px solid #d1d5db;
  padding-left: 12px;
  margin-top: 12px;
}
`;

/**
 * Check if an HTML email contains quoted content that can be hidden.
 */
export function htmlHasQuotedContent(html: string): boolean {
  return /gmail_quote|gmail_signature|divRplyFwdMsg|blockquote\s*type\s*=\s*["']cite["']|<blockquote/i.test(html);
}

// ─── Preview extraction ─────────────────────────────────────────────────

/** Strip HTML tags to get plain text */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Clean preview: no URLs, no image refs, compact whitespace */
function cleanPreview(text: string, maxLen: number): string {
  return text
    .replace(/https?:\/\/\S+/g, '') // strip URLs
    .replace(/\[cid:[^\]]+\]/g, '') // strip CID refs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Extract a clean preview from an email, stripping quoted content and URLs.
 * Prefers plain text. Returns "[Imagen]" if only images, "(Sin contenido)" if empty.
 */
export function extractPreviewText(
  bodyText: string | null,
  htmlSanitized: string | null,
): string {
  // Prefer plain text — it's always the "new" part
  if (bodyText) {
    const { newText } = splitPlainTextQuote(bodyText);
    const preview = cleanPreview(newText, 140);
    if (preview.length > 0) return preview;
  }

  // Fallback: strip HTML tags from sanitized HTML (without quotes)
  if (htmlSanitized) {
    const stripped = stripHtmlQuotes(htmlSanitized);
    const text = htmlToText(stripped);
    const preview = cleanPreview(text, 140);
    if (preview.length > 0) return preview;

    // Check if the original has images
    if (htmlSanitized.includes('<img')) return '[Imagen]';
  }

  return '(Sin contenido)';
}

/**
 * Extract the "new" text from an email for display in text mode.
 * If stripping quotes leaves nothing, returns the full text.
 */
export function extractNewContent(
  bodyText: string | null,
  htmlSanitized: string | null,
): { text: string; hasQuoted: boolean } {
  // Prefer plain text
  if (bodyText) {
    const { newText, quotedText } = splitPlainTextQuote(bodyText);
    return { text: newText, hasQuoted: quotedText !== null };
  }

  // HTML: strip quotes, convert to text
  if (htmlSanitized) {
    const stripped = stripHtmlQuotes(htmlSanitized);
    const text = htmlToText(stripped);
    const hasQuoted = htmlHasQuotedContent(htmlSanitized);

    // If stripping left nothing, return the full HTML-to-text
    if (text.trim().length === 0) {
      return { text: htmlToText(htmlSanitized), hasQuoted: false };
    }

    return { text, hasQuoted };
  }

  return { text: '', hasQuoted: false };
}

/** Check if the VISIBLE part (not quoted) has blocked external images */
export function visiblePartHasBlockedImages(html: string): boolean {
  const withoutQuotes = stripHtmlQuotes(html);
  return withoutQuotes.includes('data-original-src=');
}

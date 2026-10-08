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
 */
const QUOTE_START_PATTERNS = [
  // "On Oct 8, 2026... wrote:" (English)
  /^On .{10,80} wrote:\s*$/m,
  // "El jue, 8 oct... escribió:" (Spanish)
  /^El .{10,80} escribi[oó]:\s*$/m,
  // "Le jeu, 8 oct... a écrit:" (French)
  /^Le .{10,80} a [eé]crit\s?:\s*$/m,
  // "Am 8. Okt... schrieb:" (German)
  /^Am .{10,80} schrieb.*:\s*$/m,
  // Outlook "From: ... Sent: ..."
  /^From:\s.+\nSent:\s/m,
  // Outlook Spanish "De: ... Enviado: ..."
  /^De:\s.+\nEnviado:\s/m,
  // "-----Original Message-----"
  /^-{3,}\s*Original Message\s*-{3,}/m,
  /^-{3,}\s*Mensaje original\s*-{3,}/m,
  // Apple Mail / generic "> " quoting
  /^>{1,2}\s/m,
  // Generic divider "---" or "___"
  /^[_-]{3,}\s*$/m,
];

/**
 * Split plain text into [newContent, quotedContent].
 * Returns the full text as newContent if no quote is detected.
 */
export function splitPlainTextQuote(text: string): { newText: string; quotedText: string | null } {
  for (const pattern of QUOTE_START_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index !== undefined) {
      const newText = text.slice(0, match.index).trimEnd();
      const quotedText = text.slice(match.index);
      if (newText.length > 0) {
        return { newText, quotedText };
      }
    }
  }
  return { newText: text, quotedText: null };
}

// ─── HTML quote detection ───────────────────────────────────────────────

/**
 * CSS to hide quoted content in HTML emails displayed in an iframe.
 * Adds a "show quoted" toggle via pure CSS checkbox hack.
 */
export const QUOTE_HIDE_CSS = `
/* Hide Gmail quoted content */
.gmail_quote, .gmail_signature,
[class*="gmail_quote"], [class*="gmail_signature"] {
  display: none;
}
/* Hide Outlook quoted content */
#divRplyFwdMsg, .MsoNormal blockquote,
div[id="divRplyFwdMsg"] { display: none; }
/* Hide Apple Mail quoted content */
blockquote[type="cite"] { display: none; }
/* Hide generic blockquotes that look like quotes */
body > blockquote:last-of-type { display: none; }
/* When expanded, show everything */
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

/**
 * Extract a preview-friendly text from an email, stripping quoted content.
 * Used for the thread list preview.
 */
export function extractPreviewText(
  bodyText: string | null,
  htmlSanitized: string | null,
): string {
  // Prefer plain text
  if (bodyText) {
    const { newText } = splitPlainTextQuote(bodyText);
    return newText.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // Fallback: strip HTML tags from sanitized HTML
  if (htmlSanitized) {
    // Remove blockquotes and gmail_quote divs first
    let stripped = htmlSanitized
      .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*$/i, '')
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.slice(0, 120);
  }

  return '';
}

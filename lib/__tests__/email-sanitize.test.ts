import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml, hasExternalImages } from '../email/sanitize';

describe('sanitizeEmailHtml', () => {
  it('strips <script> tags', () => {
    const html = '<p>Hola</p><script>alert("xss")</script><p>mundo</p>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hola');
    expect(result).toContain('mundo');
  });

  it('strips <form> tags', () => {
    const html = '<form action="/steal"><input type="text" /><button>Submit</button></form>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('</form');
  });

  it('strips <iframe> tags', () => {
    const html = '<p>Antes</p><iframe src="https://evil.com"></iframe><p>Después</p>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('Antes');
    expect(result).toContain('Después');
  });

  it('strips <object> and <embed> tags', () => {
    const html = '<object data="flash.swf"></object><embed src="flash.swf">';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('removes on* event attributes', () => {
    const html = '<img src="x" onerror="alert(1)" /><div onclick="hack()">Clic</div>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('hack');
  });

  it('blocks external images and stores original src', () => {
    const html = '<img src="https://tracker.evil.com/pixel.png" alt="Foto">';
    const result = sanitizeEmailHtml(html);
    // The src attribute should have the placeholder, not the external URL
    expect(result).toMatch(/\ssrc="data:image\/png;base64,/);
    // The original URL should be preserved in data-original-src for the "Show images" button
    expect(result).toContain('data-original-src="https://tracker.evil.com/pixel.png"');
  });

  it('allows data URI images', () => {
    const html = '<img src="data:image/png;base64,abc123" alt="inline">';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('data:image/png;base64,abc123');
  });

  it('adds target="_blank" and rel="noopener noreferrer" to links', () => {
    const html = '<a href="https://example.com">Enlace</a>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('href="https://example.com"');
  });

  it('preserves basic HTML structure', () => {
    const html = '<div><h1>Título</h1><p>Párrafo con <strong>negrita</strong> y <em>cursiva</em>.</p></div>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<h1>Título</h1>');
    expect(result).toContain('<strong>negrita</strong>');
    expect(result).toContain('<em>cursiva</em>');
  });

  it('preserves table layout (common in email HTML)', () => {
    const html = '<table width="600"><tr><td>Celda</td></tr></table>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<table');
    expect(result).toContain('<td>Celda</td>');
  });

  it('preserves inline styles', () => {
    const html = '<p style="color: red; font-size: 14px;">Rojo</p>';
    const result = sanitizeEmailHtml(html);
    // sanitize-html may normalize whitespace in style values
    expect(result).toContain('color');
    expect(result).toContain('font-size');
    expect(result).toContain('Rojo');
  });

  it('handles empty input', () => {
    expect(sanitizeEmailHtml('')).toBe('');
  });

  it('handles plain text input', () => {
    const result = sanitizeEmailHtml('Solo texto sin HTML');
    expect(result).toContain('Solo texto sin HTML');
  });
});

describe('hasExternalImages', () => {
  it('returns true when blocked images are present', () => {
    const html = '<img data-original-src="https://example.com/img.png" src="data:..." />';
    expect(hasExternalImages(html)).toBe(true);
  });

  it('returns false when no blocked images', () => {
    const html = '<p>Sin imágenes externas</p>';
    expect(hasExternalImages(html)).toBe(false);
  });
});

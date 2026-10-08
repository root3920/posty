import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize inbound email HTML for safe display inside a sandboxed iframe.
 *
 * - Strips scripts, forms, iframes, objects, embeds, applets
 * - Removes all on* event attributes
 * - Blocks external images (replaces src with placeholder, stores original in data-original-src)
 * - Ensures all links open in new tab with noopener noreferrer
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  const sanitized = sanitizeHtml(rawHtml, {
    allowVulnerableTags: true, // We render in a sandboxed iframe — style tags are safe
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'style',
      'span',
      'div',
      'section',
      'article',
      'header',
      'footer',
      'nav',
      'main',
      'aside',
      'figure',
      'figcaption',
      'center',
      'font',
      'u',
      's',
      'del',
      'ins',
      'mark',
      'small',
      'big',
      'abbr',
      'cite',
      'q',
      'dfn',
      'sub',
      'sup',
      'var',
      'samp',
      'kbd',
    ]),
    disallowedTagsMode: 'discard',
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class', 'id', 'dir', 'lang', 'title', 'align', 'valign', 'width', 'height', 'bgcolor', 'color'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'data-original-src'],
      td: ['colspan', 'rowspan', 'width', 'height', 'align', 'valign', 'bgcolor', 'style'],
      th: ['colspan', 'rowspan', 'width', 'height', 'align', 'valign', 'bgcolor', 'style'],
      table: ['width', 'cellpadding', 'cellspacing', 'border', 'align', 'bgcolor', 'style'],
      font: ['color', 'size', 'face'],
    },
    // Strip all on* event handlers
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      img: ['data'], // Only allow data URIs for img src (external blocked below)
    },
    exclusiveFilter: (frame) => {
      // Remove any tag that has on* event handlers
      if (frame.attribs) {
        for (const attr of Object.keys(frame.attribs)) {
          if (attr.toLowerCase().startsWith('on')) {
            delete frame.attribs[attr];
          }
        }
      }
      return false;
    },
    transformTags: {
      // All links open in new tab
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      // Block external images — store original in data-original-src
      img: (tagName, attribs) => {
        const src = attribs.src || '';
        const isExternal =
          src.startsWith('http://') || src.startsWith('https://');

        if (isExternal) {
          return {
            tagName,
            attribs: {
              ...attribs,
              'data-original-src': src,
              src: BLOCKED_IMAGE_PLACEHOLDER,
              alt: attribs.alt || 'Imagen bloqueada',
            },
          };
        }

        return { tagName, attribs };
      },
    },
  });

  return sanitized;
}

/**
 * Check if sanitized HTML contains blocked external images.
 */
export function hasExternalImages(sanitizedHtml: string): boolean {
  return sanitizedHtml.includes('data-original-src=');
}

/**
 * 1x1 transparent PNG data URI used as placeholder for blocked images.
 */
const BLOCKED_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

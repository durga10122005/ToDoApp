/**
 * Client-Side Content Sanitizer & XSS Prevention
 * Safely cleanses HTML input and markdown preview without eval.
 */

const BLOCKED_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'style', 'link', 'meta'
]);

const ALLOWED_ATTRIBUTES = new Set([
  'href', 'title', 'target', 'rel', 'class', 'style', 'id', 'data-task-id', 'data-idx', 'data-status', 'data-priority', 'aria-label', 'aria-checked'
]);

export function sanitizeHtml(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  function cleanNode(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // 1. Remove Disallowed Elements
        if (BLOCKED_TAGS.has(tagName)) {
          child.remove();
          continue;
        }

        // 2. Clean Attributes
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          const attrName = attr.name.toLowerCase();

          // Remove inline event handlers (onclick, onerror, onload, etc.)
          if (attrName.startsWith('on')) {
            child.removeAttribute(attr.name);
            continue;
          }

          // Block javascript: and data: URIs
          if (['href', 'src', 'action'].includes(attrName)) {
            const val = attr.value.trim().toLowerCase();
            if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) {
              child.setAttribute(attr.name, '#');
              continue;
            }
          }

          // Strip non-whitelisted attributes
          if (!ALLOWED_ATTRIBUTES.has(attrName) && !attrName.startsWith('data-')) {
            child.removeAttribute(attr.name);
          }
        }

        // If link, enforce noopener noreferrer
        if (tagName === 'a') {
          child.setAttribute('rel', 'noopener noreferrer');
        }

        cleanNode(child);
      }
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

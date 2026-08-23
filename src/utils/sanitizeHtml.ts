const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
];

const DANGEROUS_ATTRIBUTES = [
  'onabort',
  'onactivate',
  'onafterprint',
  'onafterscriptexecute',
  'onbeforecopy',
  'onbeforecut',
  'onbeforepaste',
  'onbeforeprint',
  'onbeforescriptexecute',
  'onbeforeunload',
  'onblur',
  'oncanplay',
  'oncanplaythrough',
  'onchange',
  'onclick',
  'oncontextmenu',
  'oncopy',
  'oncut',
  'ondblclick',
  'ondeactivate',
  'ondrag',
  'ondragend',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondragstart',
  'ondrop',
  'ondurationchange',
  'onemptied',
  'onended',
  'onerror',
  'onfocus',
  'onhashchange',
  'oninput',
  'oninvalid',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onloadeddata',
  'onloadedmetadata',
  'onloadstart',
  'onmessage',
  'onmousedown',
  'onmouseenter',
  'onmouseleave',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'onmousewheel',
  'onoffline',
  'ononline',
  'onpagehide',
  'onpageshow',
  'onpaste',
  'onpause',
  'onplay',
  'onplaying',
  'onpopstate',
  'onprogress',
  'onratechange',
  'onreset',
  'onresize',
  'onscroll',
  'onsearch',
  'onseeked',
  'onseeking',
  'onselect',
  'onstalled',
  'onsubmit',
  'onsuspend',
  'ontimeupdate',
  'ontoggle',
  'onunload',
  'onvolumechange',
  'onwaiting',
  'onwheel',
  'srcdoc',
];

const URL_ATTRIBUTES = ['src', 'href', 'xlink:href', 'action'];

function hasDangerousProtocol(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('javascript:') || normalized.startsWith('data:') || normalized.startsWith('vbscript:');
}

export function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const nodesToRemove: Element[] = [];

  let currentNode = walker.nextNode() as Element | null;
  while (currentNode) {
    const tagName = currentNode.tagName.toLowerCase();

    if (DANGEROUS_TAGS.includes(tagName)) {
      nodesToRemove.push(currentNode);
    } else {
      for (const attr of Array.from(currentNode.attributes)) {
        const attrName = attr.name.toLowerCase();
        if (DANGEROUS_ATTRIBUTES.includes(attrName)) {
          currentNode.removeAttribute(attr.name);
        } else if (URL_ATTRIBUTES.includes(attrName) && hasDangerousProtocol(attr.value)) {
          currentNode.removeAttribute(attr.name);
        }
      }
    }

    currentNode = walker.nextNode() as Element | null;
  }

  nodesToRemove.forEach((node) => {
    node.remove();
  });

  return doc.body.innerHTML;
}

export function extractTitle(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim();
  if (title) return title;

  const firstHeading = doc.querySelector('h1, h2, h3')?.textContent?.trim();
  if (firstHeading) return firstHeading;

  const firstParagraph = doc.querySelector('p')?.textContent?.trim();
  if (firstParagraph) return firstParagraph.slice(0, 50);

  return '未命名文档';
}

export function countHighlights(html: string): number {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.querySelectorAll('.underline').length;
}

// Building the page out of text nodes.
//
// Every title, body and comment is a stranger's bytes (PEP-22), so nothing here
// ever parses HTML: children are elements or strings, and a string becomes a
// text node. There is no innerHTML anywhere in this extension.

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: { [k: string]: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // Only https links leave the extension; anything else is not a link.
    if (k === "href" && !/^(https:|#|\?|\.\/|[a-z]+\.html)/.test(v)) continue;
    e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    e.append(typeof c === "string" ? document.createTextNode(clean(c)) : c);
  }
  return e;
}

/**
 * C0 control characters, escaped as PEP-22 asks of every renderer, except the
 * line breaks and tabs a body is made of. A text node cannot run anything, but
 * a stray ESC or a bidi override still misleads whoever reads it.
 */
export function clean(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, (c) =>
    `\\u{${c.charCodeAt(0).toString(16)}}`,
  );
}

/** A key, shortened for reading; the whole value stays in the title attribute. */
export function shortKey(k: string): HTMLElement {
  return el("code", { title: k, class: "key" }, k.slice(0, 8) + "..");
}

/** A folded time (epoch milliseconds), in the reader's locale. */
export function when(ms: number): string {
  return new Date(ms).toLocaleString();
}

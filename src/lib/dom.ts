// Building the page out of text nodes.
//
// Every title, body and comment is a stranger's bytes (PEP-22), so nothing here
// ever parses HTML: children are elements or strings, and a string becomes a
// text node. There is no innerHTML anywhere in this extension.

import type { Block, Inline } from "./markdown.ts";
import { parseMarkdown } from "./markdown.ts";

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: { [k: string]: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    // Only https links leave the extension; anything else is not a link.
    if (k === "href" && !/^(https:|#|\?|\.\.?\/|[a-z]+\.html)/.test(v)) continue;
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

function inlineEls(c: Inline[]): (Node | string)[] {
  return c.map((n): Node | string => {
    switch (n.t) {
      case "text": return n.v;
      case "br": return el("br");
      case "code": return el("code", {}, n.v);
      case "strong": return el("strong", {}, ...inlineEls(n.c));
      case "em": return el("em", {}, ...inlineEls(n.c));
      case "link": return el("a", { href: n.href, rel: "nofollow noopener noreferrer", target: "_blank" }, ...inlineEls(n.c));
    }
  });
}

function blockEl(b: Block): HTMLElement {
  switch (b.t) {
    case "p": return el("p", {}, ...inlineEls(b.c));
    case "h": return el(`h${Math.min(6, Math.max(1, b.level))}` as "h1", {}, ...inlineEls(b.c));
    case "pre": return el("pre", {}, el("code", {}, b.v));
    case "quote": return el("blockquote", {}, ...b.c.map(blockEl));
    case "hr": return el("hr");
    case "list": return el(b.ordered ? "ol" : "ul", {}, ...b.items.map((it) => el("li", {}, ...it.map(blockEl))));
  }
}

/** A body as GitHub would show it, built from elements and text nodes only. */
export function markdownEl(src: string): HTMLElement {
  return el("div", { class: "hbs2-md" }, ...parseMarkdown(src).map(blockEl));
}

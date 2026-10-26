// A small Markdown reader for thread bodies, producing a tree and never HTML.
//
// Bodies are a stranger's text. GitHub renders them as Markdown, so this does
// too, but it reads only what issue text usually is (paragraphs, line breaks,
// headings, lists, quotes, fenced and inline code, emphasis, links) and turns
// everything else into text. There is no raw HTML: a `<b>` in a body is the
// three characters `<b>`. Links keep only `https:` and `http:` targets; any
// other scheme stays text.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "br" };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: number; c: Inline[] }
  | { t: "pre"; v: string; lang: string }
  | { t: "quote"; c: Block[] }
  | { t: "list"; ordered: boolean; items: Block[][] }
  | { t: "hr" };

const FENCE = /^ {0,3}(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const HR = /^ {0,3}([-*_])( *\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;

export function parseMarkdown(src: string): Block[] {
  return blocks(src.replace(/\r\n?/g, "\n").split("\n"));
}

function blocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const close = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(close)) body.push(lines[i++]!);
      i++;
      out.push({ t: "pre", v: body.join("\n"), lang: fence[2] ?? "" });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) { out.push({ t: "h", level: h[1]!.length, c: inline(h[2] ?? "") }); i++; continue; }

    if (HR.test(line)) { out.push({ t: "hr" }); i++; continue; }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) body.push(QUOTE.exec(lines[i++]!)![1] ?? "");
      out.push({ t: "quote", c: blocks(body) });
      continue;
    }

    const item = ITEM.exec(line);
    if (item) {
      const indent = item[1]!.length;
      const ordered = /\d/.test(item[2]!);
      const items: Block[][] = [];
      while (i < lines.length) {
        const m = ITEM.exec(lines[i]!);
        if (!m || m[1]!.length !== indent || /\d/.test(m[2]!) !== ordered) break;
        const body = [m[3] ?? ""];
        i++;
        // The item goes on while lines are indented past its marker, or blank
        // with an indented line after; a nested list is such a line.
        while (i < lines.length) {
          const l = lines[i]!;
          const deeper = l.startsWith(" ".repeat(indent + 1)) && l.trim() !== "";
          const blankThenDeeper = l.trim() === "" && (lines[i + 1] ?? "").startsWith(" ".repeat(indent + 2));
          if (!deeper && !blankThenDeeper) break;
          body.push(l.slice(Math.min(indent + 2, l.length - l.trimStart().length)));
          i++;
        }
        items.push(blocks(body));
      }
      out.push({ t: "list", ordered, items });
      continue;
    }

    // A paragraph: lines up to a blank one or the start of another block.
    // Single line breaks are kept, as GitHub keeps them in issue text.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === "" || FENCE.test(l) || HEADING.test(l) || HR.test(l) || QUOTE.test(l) || ITEM.test(l)) break;
      para.push(l.trim());
      i++;
    }
    const c: Inline[] = [];
    para.forEach((l, k) => {
      if (k > 0) c.push({ t: "br" });
      c.push(...inline(l));
    });
    out.push({ t: "p", c });
  }
  return out;
}

function safeHref(href: string): string | null {
  return /^https?:\/\/[^\s<>"]+$/i.test(href) ? href : null;
}

/** The inline spans of one line. */
export function inline(s: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ t: "text", v: text }); text = ""; } };
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    const rest = s.slice(i);
    if (ch === "\\" && i + 1 < s.length && /[\\`*_[\]()#+\-.!>~|]/.test(s[i + 1]!)) {
      text += s[i + 1]; i += 2; continue;
    }
    if (ch === "`") {
      const run = /^`+/.exec(rest)![0];
      const end = s.indexOf(run, i + run.length);
      if (end > 0) {
        flush();
        out.push({ t: "code", v: s.slice(i + run.length, end).replace(/^ (.*) $/, "$1") });
        i = end + run.length; continue;
      }
    }
    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (strong) { flush(); out.push({ t: "strong", c: inline(strong[2]!) }); i += strong[0].length; continue; }
    const em = /^(\*|_)(?=\S)([\s\S]*?\S)\1(?!\w)/.exec(rest);
    if (em && (ch === "*" || i === 0 || !/\w/.test(s[i - 1]!))) {
      flush(); out.push({ t: "em", c: inline(em[2]!) }); i += em[0].length; continue;
    }
    const link = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      const href = safeHref(link[2]!);
      flush();
      if (href) out.push({ t: "link", href, c: inline(link[1]!) });
      else out.push(...inline(link[1]!));
      i += link[0].length; continue;
    }
    const auto = /^https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'*_]/i.exec(rest);
    if (auto && (i === 0 || /[\s(]/.test(s[i - 1]!))) {
      flush(); out.push({ t: "link", href: auto[0], c: [{ t: "text", v: auto[0] }] }); i += auto[0].length; continue;
    }
    text += ch; i++;
  }
  flush();
  return out;
}

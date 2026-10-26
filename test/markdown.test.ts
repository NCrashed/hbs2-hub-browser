import { test } from "node:test";
import assert from "node:assert/strict";
import { inline, parseMarkdown } from "../src/lib/markdown.ts";

test("paragraphs keep single line breaks and split on blank lines", () => {
  assert.deepEqual(parseMarkdown("a\nb\n\nc"), [
    { t: "p", c: [{ t: "text", v: "a" }, { t: "br" }, { t: "text", v: "b" }] },
    { t: "p", c: [{ t: "text", v: "c" }] },
  ]);
});

test("a list, the way agents write their questions", () => {
  const md = "Please describe:\n- the objects;\n- the walk, and `PickupItemRange`;\n\nDone.";
  const b = parseMarkdown(md);
  assert.equal(b.length, 3);
  assert.equal(b[1]!.t, "list");
  const list = b[1] as { t: "list"; ordered: boolean; items: unknown[][] };
  assert.equal(list.ordered, false);
  assert.equal(list.items.length, 2);
  assert.deepEqual(list.items[1], [{ t: "p", c: [{ t: "text", v: "the walk, and " }, { t: "code", v: "PickupItemRange" }, { t: "text", v: ";" }] }]);
});

test("a nested list and an ordered one", () => {
  const b = parseMarkdown("- made:\n  - order 1163;\n  - record 1164.\n- freed\n\n1. one\n2. two");
  assert.equal(b[0]!.t, "list");
  const outer = b[0] as { t: "list"; items: { t: string }[][] };
  assert.equal(outer.items.length, 2);
  assert.equal(outer.items[0]![1]!.t, "list");
  assert.equal((b[1] as { ordered: boolean }).ordered, true);
});

test("fenced code is kept verbatim, markup and all", () => {
  assert.deepEqual(parseMarkdown("```haskell\nx = <b>*y*</b>\n```"), [{ t: "pre", v: "x = <b>*y*</b>", lang: "haskell" }]);
});

test("headings, quotes and rules", () => {
  const b = parseMarkdown("## Answer\n> quoted\n> more\n\n---");
  assert.deepEqual(b[0], { t: "h", level: 2, c: [{ t: "text", v: "Answer" }] });
  assert.equal(b[1]!.t, "quote");
  assert.deepEqual(b[2], { t: "hr" });
});

test("raw HTML is text", () => {
  assert.deepEqual(inline("<img src=x onerror=alert(1)>"), [{ t: "text", v: "<img src=x onerror=alert(1)>" }]);
});

test("a link keeps only an http(s) target", () => {
  assert.deepEqual(inline("[ok](https://example.com/a)"), [{ t: "link", href: "https://example.com/a", c: [{ t: "text", v: "ok" }] }]);
  assert.deepEqual(inline("[bad](javascript:alert(1))"), [{ t: "text", v: "bad" }, { t: "text", v: ")" }]);
  assert.deepEqual(inline("[bad](data:text/html,x)"), [{ t: "text", v: "bad" }]);
});

test("a bare URL is a link, without the punctuation after it", () => {
  assert.deepEqual(inline("see https://wiki.ubuntu.com/GccSsp."), [
    { t: "text", v: "see " }, { t: "link", href: "https://wiki.ubuntu.com/GccSsp", c: [{ t: "text", v: "https://wiki.ubuntu.com/GccSsp" }] }, { t: "text", v: "." },
  ]);
});

test("emphasis, and underscores inside words are not", () => {
  assert.deepEqual(inline("**bold** and *it*"), [
    { t: "strong", c: [{ t: "text", v: "bold" }] }, { t: "text", v: " and " }, { t: "em", c: [{ t: "text", v: "it" }] },
  ]);
  assert.deepEqual(inline("EVENT_UNIT_PICKUP_ITEM"), [{ t: "text", v: "EVENT_UNIT_PICKUP_ITEM" }]);
});

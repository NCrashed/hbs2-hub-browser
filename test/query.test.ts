import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRows, parseQuery } from "../src/lib/query.ts";
import type { IndexRow } from "../src/lib/docs.ts";

const row = (number: number, title: string, status: string, kind: "issue" | "pr" = "issue", labels: string[] = []): IndexRow => ({
  number, kind, thread_id: `t${number}`, title, status, labels, author: "a", comments: 0,
  created_at: 0, updated_at: 0, redacted: false,
});

test("no query is GitHub's default: open", () => {
  assert.deepEqual(parseQuery(null), { state: "open", labels: [], words: [] });
});

test("the state, labels and words of a query", () => {
  assert.deepEqual(parseQuery("is:issue state:closed"), { state: "closed", labels: [], words: [] });
  assert.deepEqual(parseQuery('is:pr is:merged label:"good first issue" turtle Glitch'),
    { state: "merged", labels: ["good first issue"], words: ["turtle", "glitch"] });
  assert.deepEqual(parseQuery("is:issue label:bug,ui -label:wontfix author:x"),
    { state: null, labels: ["bug", "ui"], words: [] });
});

test("rows follow the state, and closed pull requests include merged ones", () => {
  const rows = [row(1, "a", "open"), row(2, "b", "closed"), row(3, "c", "merged", "pr"), row(4, "d", "closed", "pr")];
  assert.deepEqual(filterRows(rows, parseQuery("state:open")).map((r) => r.number), [1]);
  assert.deepEqual(filterRows(rows, parseQuery("is:closed")).map((r) => r.number), [2, 3, 4]);
  assert.deepEqual(filterRows(rows, parseQuery("is:issue")).map((r) => r.number), [1, 2, 3, 4]);
});

test("rows follow labels and words in the title", () => {
  const rows = [row(10, "Bladestorm at level 6", "open", "issue", ["sim"]), row(14, "Turtle glitch", "open")];
  assert.deepEqual(filterRows(rows, parseQuery("is:open turtle")).map((r) => r.number), [14]);
  assert.deepEqual(filterRows(rows, parseQuery("is:open label:sim")).map((r) => r.number), [10]);
  assert.deepEqual(filterRows(rows, parseQuery("is:open nothing")).map((r) => r.number), []);
});

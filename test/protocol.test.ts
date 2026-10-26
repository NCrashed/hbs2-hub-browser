import { test } from "node:test";
import assert from "node:assert/strict";
import { mayCall, toolInfo } from "../src/lib/protocol.ts";
import type { ToolInfo } from "../src/lib/protocol.ts";

const table = new Map<string, ToolInfo>([
  ["issue_list", { name: "issue_list", title: "List issues", readOnly: true }],
  ["inbox_accept", { name: "inbox_accept", title: "Accept", readOnly: false }],
]);

test("a GitHub page may read and may not write", () => {
  assert.ok(mayCall("content", "issue_list", table));
  assert.ok(!mayCall("content", "inbox_accept", table));
});

test("a tool the host did not describe is a write", () => {
  assert.ok(!mayCall("content", "something_new", table));
  assert.ok(!mayCall("page", "something_new", table));
});

test("an extension page may call what the host offers", () => {
  assert.ok(mayCall("page", "inbox_accept", table));
});

test("a tool row reads readOnlyHint and nothing looser", () => {
  assert.deepEqual(toolInfo({ name: "a", title: "A", annotations: { readOnlyHint: true } }), { name: "a", title: "A", readOnly: true });
  assert.equal(toolInfo({ name: "b", annotations: { readOnlyHint: "yes" } })?.readOnly, false);
  assert.equal(toolInfo({ title: "no name" }), null);
});

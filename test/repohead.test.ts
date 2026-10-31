import { test } from "node:test";
import assert from "node:assert/strict";
import { countsWithInbox } from "../src/lib/repostate.ts";

test("the repository tabs carry the mailbox count status already returned", () => {
  const counts = { issues: 3, pulls: 1 };
  assert.deepEqual(countsWithInbox(counts, 2), { issues: 3, pulls: 1, inbox: 2 });
  assert.deepEqual(countsWithInbox(counts, 0), { issues: 3, pulls: 1, inbox: 0 });
  assert.deepEqual(countsWithInbox(counts, null), counts);
});

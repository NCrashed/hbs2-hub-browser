import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptedPullNumber, acceptedPullUrl } from "../src/lib/acceptance.ts";
import type { IndexRow, LetterDoc } from "../src/lib/docs.ts";

const letter = (thread: string | null, number: number | null, pr = true): LetterDoc => ({
  contract: 1,
  document: "letter",
  message: "message",
  author: "author",
  op: "open",
  folded: false,
  triage: null,
  subject: { thread, number, kind: pr ? "pr" : "issue", title: "Change", in_canon: false },
  body: null,
  labels_requested: [],
  pr: pr ? { tip: "deadbeef" } : null,
  attachments: [],
  unreadable: null,
});

const row = (thread_id: string, number: number): IndexRow => ({
  number,
  kind: "pr",
  thread_id,
  title: "Change",
  status: "open",
  labels: [],
  author: "author",
  comments: 0,
  created_at: 0,
  updated_at: 0,
  redacted: false,
});

test("an accepted new pull request is found by its stable thread id", () => {
  assert.equal(acceptedPullNumber(letter("thread-new", null), [row("other", 1), row("thread-new", 2)]), 2);
});

test("an accepted revision keeps the number already named by the letter", () => {
  assert.equal(acceptedPullNumber(letter("thread-old", 7), []), 7);
});

test("issues and an unreadable pull identity do not invent a destination", () => {
  assert.equal(acceptedPullNumber(letter("issue", null, false), [row("issue", 3)]), null);
  assert.equal(acceptedPullNumber(letter(null, null), [row("other", 3)]), null);
});

test("the destination preserves repository context", () => {
  assert.equal(
    acceptedPullUrl("repo-key", "owner/name", 7),
    "thread.html?key=repo-key&kind=pr&number=7&gh=owner%2Fname",
  );
});

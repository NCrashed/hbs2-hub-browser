import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultOnto, labelsOf, missing, planOf, roleOf, NO_ROLE } from "../src/lib/compose.ts";

const repo = "BFdfBwp9epkgQmNBFS3KjkULmb6RNzq7qkVaPhT7ZSVq";
const status = {
  signing: true,
  signer: { key: "3a8Rv9dbVQAprna3GzgfihUpq64wCSLX2nyfhgDB5MH3", maintainer: true },
  clone: { branch: "fold-files", onto: null, branches: ["fold-files", "master"] },
  mailbox: { key: "m", waiting: 2 },
};

test("the role comes out of the status document", () => {
  const r = roleOf(status);
  assert.equal(r.maintainer, true);
  assert.equal(r.branch, "fold-files");
  assert.equal(defaultOnto(r), "master");
  assert.equal(r.waiting, 2);
  // Signing as a key that may not bless is not maintaining.
  assert.equal(roleOf({ ...status, signer: { key: "k", maintainer: false } }).maintainer, false);
  assert.equal(roleOf({ ...status, signing: false }).maintainer, false);
  assert.deepEqual(roleOf(null), NO_ROLE);
});

test("a maintainer writes canon and publishes; anybody else sends a letter", () => {
  const t = { repo, kind: "issue" as const, number: 3 };
  const m = roleOf(status);
  assert.deepEqual([planOf("issue", m, { title: "t" }, t).tool, planOf("issue", m, { title: "t" }, t).publish], ["issue_open", true]);
  assert.deepEqual([planOf("issue", NO_ROLE, { title: "t" }, t).tool, planOf("issue", NO_ROLE, { title: "t" }, t).publish], ["issue_new", false]);
  assert.equal(planOf("comment", m, { body: "b" }, t).tool, "issue_reply");
  assert.deepEqual(planOf("comment", NO_ROLE, { body: "b" }, { ...t, kind: "pr" }).args,
                   { repo, number: 3, kind: "pr", body: "b" });
});

test("a pull request and a merge carry what the form says, and nothing it left empty", () => {
  const m = roleOf(status);
  assert.deepEqual(planOf("pr", m, { title: "t", body: " ", from: "fold-files" }, { repo, kind: "pr", number: null }).args,
                   { repo, title: "t", onto: "master", from: "fold-files" });
  assert.deepEqual(planOf("land", m, { message: "", noMirror: true }, { repo, kind: "pr", number: 1 }).args,
                   { repo, number: 1, no_mirror: true });
});

test("labels and what a form is missing", () => {
  assert.deepEqual(labelsOf(" bug, docs,,bug "), ["bug", "docs"]);
  assert.equal(missing("issue", { title: "  " }), "A title is needed.");
  assert.equal(missing("comment", { body: "" }), "The comment is empty.");
  assert.equal(missing("pr", { title: "t", from: "x", onto: "x" }), "A branch cannot be proposed onto itself.");
  assert.equal(missing("land", {}), null);
});

test("closing, reopening and labels are canon writes, published", () => {
  const m = roleOf(status);
  const t = { repo, kind: "pr" as const, number: 2 };
  assert.deepEqual(planOf("close", m, { body: "done" }, t).args, { repo, number: 2, kind: "pr", note: "done" });
  assert.equal(planOf("reopen", m, {}, t).tool, "issue_reopen");
  assert.deepEqual(planOf("label", m, { labels: "bug, ui" }, t).args, { repo, number: 2, kind: "pr", labels: ["bug", "ui"] });
  assert.deepEqual(planOf("label", m, { labels: " " }, t).args, { repo, number: 2, kind: "pr", clear: true });
  assert.equal(planOf("label", m, {}, t).publish, true);
});

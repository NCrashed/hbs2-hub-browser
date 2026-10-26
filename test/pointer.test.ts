import { test } from "node:test";
import assert from "node:assert/strict";
import { isRepoKey, parsePointer, repoFromPath } from "../src/lib/pointer.ts";

const KEY = "7VM1rtxrTmpXYVidNFHu5ZbNqRKMhKoRAV8vJebGaRN9";

test("a pointer names its key and nothing else", () => {
  assert.equal(parsePointer(`hbs23://${KEY}\n`), KEY);
  assert.equal(parsePointer(`# where the issues live\n\n  hbs23://${KEY}  \nignored`), KEY);
  assert.equal(parsePointer(`hbs23://${KEY}\r\n`), KEY);
});

test("a pointer that says something else names nothing", () => {
  assert.equal(parsePointer(""), null);
  assert.equal(parsePointer("# only a comment"), null);
  assert.equal(parsePointer(`https://example.com/${KEY}`), null);
  assert.equal(parsePointer("hbs23://../../etc"), null);
  assert.equal(parsePointer(`hbs23://${KEY} extra`), null);
  // The FIRST line counts: a later valid one does not rescue a bad first.
  assert.equal(parsePointer(`hbs23://nope\nhbs23://${KEY}`), null);
});

test("a key is base58 of the right length", () => {
  assert.ok(isRepoKey(KEY));
  assert.ok(!isRepoKey("0OIl" + KEY.slice(4)));
  assert.ok(!isRepoKey("short"));
});

test("a GitHub path is inside a repository, or not", () => {
  assert.deepEqual(repoFromPath("/NCrashed/openwar3"), { owner: "NCrashed", repo: "openwar3", view: "code" });
  assert.deepEqual(repoFromPath("/NCrashed/openwar3/issues"), { owner: "NCrashed", repo: "openwar3", view: "issues" });
  assert.deepEqual(repoFromPath("/NCrashed/openwar3/pulls"), { owner: "NCrashed", repo: "openwar3", view: "pulls" });
  assert.equal(repoFromPath("/NCrashed/openwar3/issues/4")?.view, "other");
  assert.equal(repoFromPath("/settings/profile"), null);
  assert.equal(repoFromPath("/orgs/foo"), null);
  assert.equal(repoFromPath("/"), null);
  assert.equal(repoFromPath("/NCrashed"), null);
});

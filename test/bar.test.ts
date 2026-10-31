import { test } from "node:test";
import assert from "node:assert/strict";
import { syncRepository } from "../src/lib/repostate.ts";

test("the local Sync action calls the existing sync tool and reloads fresh data", async () => {
  const calls: unknown[] = [];
  const progress: string[] = [];
  let reloads = 0;
  await syncRepository(
    "repo-key",
    async (tool, args, report) => { calls.push([tool, args]); report?.("fetching the record"); return null; },
    () => { reloads += 1; },
    (s) => { progress.push(s); },
  );
  assert.deepEqual(calls, [["sync", { repo: "repo-key" }]]);
  assert.deepEqual(progress, ["fetching the record"]);
  assert.equal(reloads, 1);
});

test("a failed Sync keeps the current page and its error", async () => {
  const failure = new Error("remote is unavailable");
  let reloads = 0;
  await assert.rejects(
    syncRepository("repo-key", async () => { throw failure; }, () => { reloads += 1; }),
    failure,
  );
  assert.equal(reloads, 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileName, parseDiff } from "../src/lib/diff.ts";

const one = 'diff --git a/greet.sh b/greet.sh\nindex a8f6cd3..78034fe 100644\n--- a/greet.sh\n+++ b/greet.sh\n@@ -1,2 +1,2 @@\n #!/bin/sh\n-echo "Helo, $1"\n+echo "Hello, $1"\n';

test("one file, numbered on both sides", () => {
  const [f, ...rest] = parseDiff(one);
  assert.equal(rest.length, 0);
  assert.equal(fileName(f!), "greet.sh");
  assert.equal(f!.change, "modified");
  assert.deepEqual([f!.adds, f!.dels], [1, 1]);
  assert.deepEqual(f!.hunks[0]!.lines, [
    { kind: "ctx", old: 1, new: 1, text: "#!/bin/sh" },
    { kind: "del", old: 2, new: null, text: 'echo "Helo, $1"' },
    { kind: "add", old: null, new: 2, text: 'echo "Hello, $1"' },
  ]);
});

test("added, deleted, renamed and binary files", () => {
  const d = [
    "diff --git a/new.txt b/new.txt", "new file mode 100644", "--- /dev/null", "+++ b/new.txt", "@@ -0,0 +1 @@", "+hi",
    "diff --git a/old.txt b/old.txt", "deleted file mode 100644", "--- a/old.txt", "+++ /dev/null", "@@ -1 +0,0 @@", "-bye",
    "diff --git a/a.md b/b.md", "similarity index 90%", "rename from a.md", "rename to b.md",
    "diff --git a/img.png b/img.png", "Binary files a/img.png and b/img.png differ",
  ].join("\n");
  const fs = parseDiff(d);
  assert.deepEqual(fs.map((f) => [f.change, fileName(f), f.binary]), [
    ["added", "new.txt", false], ["deleted", "old.txt", false], ["renamed", "a.md -> b.md", false], ["modified", "img.png", true],
  ]);
  assert.equal(fs[0]!.hunks[0]!.lines[0]!.new, 1);
});

test("two hunks restart the numbering", () => {
  const d = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n-a\n+b\n@@ -10,2 +10,3 @@ fn\n c\n+d\n e\n\\ No newline at end of file\n";
  const [f] = parseDiff(d);
  assert.equal(f!.hunks.length, 2);
  assert.deepEqual(f!.hunks[1]!.lines.map((l) => [l.kind, l.old, l.new]),
    [["ctx", 10, 10], ["add", null, 11], ["ctx", 11, 12], ["note", null, null]]);
});

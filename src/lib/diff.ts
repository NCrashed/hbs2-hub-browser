// A unified diff, read into files, hunks and numbered lines, the way GitHub's
// "Files changed" shows one. The text is git's own (`hub pr show` precomputes
// it, PEP-22); nothing here runs git.

export interface DiffLine {
  kind: "ctx" | "add" | "del" | "note";
  /** Line number on the old side, for context and deleted lines. */
  old: number | null;
  /** Line number on the new side, for context and added lines. */
  new: number | null;
  text: string;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  /** "added", "deleted", "renamed" or "modified". */
  change: "added" | "deleted" | "renamed" | "modified";
  binary: boolean;
  adds: number;
  dels: number;
  hunks: Hunk[];
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

function unquote(p: string): string {
  return p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p;
}

function side(p: string | undefined, prefix: string): string | null {
  if (p === undefined || p === "/dev/null") return null;
  const q = unquote(p.trim());
  return q.startsWith(prefix) ? q.slice(prefix.length) : q;
}

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let f: DiffFile | null = null;
  let h: Hunk | null = null;
  let oldN = 0;
  let newN = 0;

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = /^diff --git (\S+|"[^"]*") (\S+|"[^"]*")$/.exec(line);
      f = { oldPath: side(m?.[1], "a/"), newPath: side(m?.[2], "b/"), change: "modified",
            binary: false, adds: 0, dels: 0, hunks: [] };
      files.push(f);
      h = null;
      continue;
    }
    if (!f) continue;
    if (h === null) {
      if (line.startsWith("new file mode")) f.change = "added";
      else if (line.startsWith("deleted file mode")) f.change = "deleted";
      else if (line.startsWith("rename from ")) { f.change = "renamed"; f.oldPath = line.slice(12); }
      else if (line.startsWith("rename to ")) f.newPath = line.slice(10);
      else if (line.startsWith("Binary files ")) f.binary = true;
      else if (line.startsWith("--- ")) { if (line.slice(4) === "/dev/null") f.oldPath = null; }
      else if (line.startsWith("+++ ")) { if (line.slice(4) === "/dev/null") f.newPath = null; }
    }
    const hm = HUNK.exec(line);
    if (hm) {
      oldN = Number(hm[1]);
      newN = Number(hm[2]);
      h = { header: line, lines: [] };
      f.hunks.push(h);
      continue;
    }
    if (!h) continue;
    if (line.startsWith("+")) { h.lines.push({ kind: "add", old: null, new: newN++, text: line.slice(1) }); f.adds++; }
    else if (line.startsWith("-")) { h.lines.push({ kind: "del", old: oldN++, new: null, text: line.slice(1) }); f.dels++; }
    else if (line.startsWith(" ")) h.lines.push({ kind: "ctx", old: oldN++, new: newN++, text: line.slice(1) });
    else if (line.startsWith("\\")) h.lines.push({ kind: "note", old: null, new: null, text: line });
  }
  return files;
}

/** The name a file is shown under: the new path, or the old one for a deletion. */
export function fileName(f: DiffFile): string {
  if (f.change === "renamed" && f.oldPath && f.newPath) return `${f.oldPath} -> ${f.newPath}`;
  return f.newPath ?? f.oldPath ?? "(unknown)";
}

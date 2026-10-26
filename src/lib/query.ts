// GitHub's issue and pull request search, as far as the hbs2 rows follow it.
//
// The rows sit in GitHub's own list, so they should answer the same question the
// list does. Only the parts that mean something for an hbs2 thread are read:
// the state, applied labels, and free words matched against the title. Anything
// else (author:, assignee:, sort:, ...) is ignored, which shows more hbs2 rows
// rather than hiding some for a reason the reader cannot see.
import type { IndexRow } from "./docs.ts";

export interface Query {
  /** "open" | "closed" | "merged", or null for any state. */
  state: string | null;
  labels: string[];
  words: string[];
}

/** Split a GitHub search into terms, keeping quoted values together. */
function terms(q: string): string[] {
  const out: string[] = [];
  const re = /(\S+?):"([^"]*)"|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q)) !== null) {
    if (m[1] !== undefined) out.push(`${m[1]}:${m[2] ?? ""}`);
    else if (m[3] !== undefined) out.push(m[3]);
    else if (m[4] !== undefined) out.push(m[4]);
  }
  return out;
}

/**
 * What the `q` of an issues or pulls URL asks for.
 *
 * No `q` at all is GitHub's default view, which is the open ones.
 */
export function parseQuery(q: string | null): Query {
  if (q === null) return { state: "open", labels: [], words: [] };
  let state: string | null = null;
  const labels: string[] = [];
  const words: string[] = [];
  for (const t of terms(q)) {
    const m = /^(-?)([a-z]+):(.*)$/i.exec(t);
    if (!m) { words.push(t.toLowerCase()); continue; }
    const [, neg, k, v] = m;
    if (neg) continue;
    const key = (k ?? "").toLowerCase();
    const val = (v ?? "").toLowerCase();
    if ((key === "is" || key === "state") && ["open", "closed", "merged"].includes(val)) state = val;
    else if (key === "label") labels.push(...val.split(",").filter((x) => x !== ""));
  }
  return { state, labels, words };
}

/** The rows the query keeps. GitHub's "closed" pull requests include the merged ones. */
export function filterRows(rows: IndexRow[], q: Query): IndexRow[] {
  return rows.filter((r) => {
    if (q.state) {
      const s = r.status.toLowerCase();
      const ok = q.state === "closed" && r.kind === "pr" ? s === "closed" || s === "merged" : s === q.state;
      if (!ok) return false;
    }
    const labels = r.labels.map((l) => l.toLowerCase());
    if (!q.labels.every((l) => labels.includes(l))) return false;
    const title = (r.redacted ? "" : r.title ?? "").toLowerCase();
    return q.words.every((w) => title.includes(w));
  });
}

/** "3 hours ago", in the reader's language when the browser has it. */
export function ago(ms: number, now: number = Date.now()): string {
  const s = Math.round((ms - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [30, "day"], [12, "month"], [Infinity, "year"],
  ];
  let v = s;
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return rtf.format(v, unit);
    v = Math.round(v / n);
  }
  return rtf.format(v, "year");
}

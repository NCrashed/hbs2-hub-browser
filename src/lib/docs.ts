// The render-contract documents the host returns (PEP-22, PEP-24), as types.
// Readers ignore fields they do not know, so these list only what is used.
import type { Json } from "./protocol.ts";

export interface IndexRow {
  number: number | null;
  kind: "issue" | "pr";
  thread_id: string;
  title: string | null;
  status: string;
  labels: string[];
  author: string;
  comments: number;
  created_at: number;
  updated_at: number;
  redacted: boolean;
}

export interface IndexDoc {
  contract: number;
  document: "index";
  repo: string;
  threads: IndexRow[];
}

export interface Comment {
  event_id: string;
  author: string;
  canon_by: string;
  ts: number;
  body: string | null;
  redacted: boolean;
}

export interface ThreadDoc {
  contract: number;
  document: "thread";
  kind: "issue" | "pr";
  number: number | null;
  thread_id: string;
  title: string | null;
  status: string;
  labels: string[];
  assignees: string[];
  author: string;
  canon_by: string;
  created_at: number;
  updated_at: number;
  redacted: boolean;
  body: string | null;
  labels_requested: string[];
  comments: Comment[];
  pr?: {
    onto: string;
    base: string;
    tip: string;
    source: string | null;
    source_ref: string | null;
    merge_commit: string | null;
    merged_into?: string | null;
    diff?: { availability: string; truncated: boolean; text: string };
  };
}

/** One letter in the triage queue (`hub inbox --json`). */
export interface QueueLetter {
  message: string;
  author: string | null;
  op: string | null;
  title: string | null;
  /** The thread a comment or a request is about; null for an open. */
  thread: string | null;
  declared_at: number | null;
  /** Whether it would fold: "folds", or why not. */
  disposition: string;
  unreadable: string | null;
}

export interface QueueDoc {
  contract: number;
  document: "queue";
  letters: QueueLetter[];
  omitted: number;
  cursor: string | null;
  denied: number;
}

/** One letter, whole (`hub inbox show --json`). */
export interface LetterDoc {
  contract: number;
  document: "letter";
  message: string;
  author: string | null;
  op: string | null;
  folded: boolean;
  triage: { verdict: string; reason: { code?: string; message?: string } | null } | null;
  subject: { thread: string | null; number: number | null; kind: "issue" | "pr" | null; title: string | null; in_canon: boolean } | null;
  body: string | null;
  labels_requested: string[];
  pr: { onto?: string; source_ref?: string; tip?: string; base?: string } | null;
  attachments: unknown[];
  unreadable: string | null;
}

export function asQueue(v: Json): QueueDoc {
  if (!isDoc(v, "queue")) throw new Error("the host did not return a queue document");
  return v as unknown as QueueDoc;
}

export function asLetter(v: Json): LetterDoc {
  if (!isDoc(v, "letter")) throw new Error("the host did not return a letter document");
  return v as unknown as LetterDoc;
}

/** The contract this build was written against; a larger one may mean a field changed meaning. */
export const CONTRACT = 1;

function isDoc(v: Json, kind: string): v is { [k: string]: Json } {
  return !!v && typeof v === "object" && !Array.isArray(v) && v["document"] === kind;
}

export function asIndex(v: Json): IndexDoc {
  if (!isDoc(v, "index")) throw new Error("the host did not return an index document");
  return v as unknown as IndexDoc;
}

export function asThread(v: Json): ThreadDoc {
  if (!isDoc(v, "thread")) throw new Error("the host did not return a thread document");
  return v as unknown as ThreadDoc;
}

export function newerContract(d: { contract: number }): boolean {
  return d.contract > CONTRACT;
}

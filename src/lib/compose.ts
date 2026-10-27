// What a form asks the host to do (PEP-24 phases 2 and 3): which tool, with
// which arguments, and whether canon is published after. Kept apart from the
// page so the choice is a function a test can call.
//
// THE ROLE DECIDES THE TOOL. A maintainer writes canon directly (issue_open,
// issue_reply) and publishes it; anybody else sends a letter (issue_new,
// issue_comment), which is a request until a maintainer accepts it. A pull
// request is always a letter, since its commits travel as the letter's bundle;
// merging one is a maintainer's (pr_land), and publishes by itself.
import type { Json } from "./protocol.ts";

export type Op = "issue" | "comment" | "pr" | "land" | "close" | "reopen" | "label";

/** What only a maintainer may do: the canon verbs with no letter behind them. */
export const MAINTAINER_ONLY: readonly Op[] = ["land", "close", "reopen", "label"];

export interface Role {
  /** This clone signs canon as a key that may bless it. */
  maintainer: boolean;
  /** The key a canon write would sign with. */
  signer: string | null;
  /** The branch checked out in the working clone. */
  branch: string | null;
  /** The branch the clone's hbs23 remote names as HEAD, when it knows. */
  onto: string | null;
  branches: string[];
  /** Letters waiting in the repository's mailbox, when the peer could say. */
  waiting: number | null;
}

export const NO_ROLE: Role = { maintainer: false, signer: null, branch: null, onto: null, branches: [], waiting: null };

function obj(v: Json | undefined): { [k: string]: Json } | null {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function str(v: Json | undefined): string | null {
  return typeof v === "string" ? v : null;
}

/** The role, read out of the status document. */
export function roleOf(status: Json): Role {
  const s = obj(status);
  if (!s) return NO_ROLE;
  const signer = obj(s["signer"]);
  const clone = obj(s["clone"]);
  const mailbox = obj(s["mailbox"]);
  const waiting = mailbox?.["waiting"];
  const bs = clone?.["branches"];
  return {
    maintainer: s["signing"] === true && signer?.["maintainer"] === true,
    signer: str(signer?.["key"]),
    branch: str(clone?.["branch"]),
    onto: str(clone?.["onto"]),
    branches: Array.isArray(bs) ? bs.filter((b): b is string => typeof b === "string") : [],
    waiting: typeof waiting === "number" ? waiting : null,
  };
}

/** The branch a pull request goes onto unless the form says otherwise. */
export function defaultOnto(r: Role): string {
  if (r.onto) return r.onto;
  for (const b of ["master", "main"]) if (r.branches.includes(b)) return b;
  return r.branches[0] ?? "master";
}

export function labelsOf(text: string): string[] {
  return [...new Set(text.split(",").map((l) => l.trim()).filter((l) => l.length > 0))];
}

export interface Form {
  title?: string;
  body?: string;
  labels?: string;
  onto?: string;
  from?: string;
  message?: string;
  noMirror?: boolean;
}

export interface Target {
  repo: string;
  kind: "issue" | "pr";
  number: number | null;
}

export interface Plan {
  tool: string;
  args: { [k: string]: Json };
  /** Canon is written here, so publish runs after. */
  publish: boolean;
  /** One sentence for the review: what signing this does. */
  what: string;
}

export function planOf(op: Op, role: Role, f: Form, t: Target): Plan {
  type Args = { [k: string]: Json };
  const body: Args = f.body?.trim() ? { body: f.body } : {};
  const thread = { number: t.number ?? 0, kind: t.kind };
  switch (op) {
    case "issue": {
      const labels = labelsOf(f.labels ?? "");
      return role.maintainer
        ? { tool: "issue_open", publish: true,
            args: { repo: t.repo, title: f.title ?? "", ...body, ...(labels.length ? { labels } : {} as Args) },
            what: "Opens the issue straight in canon, signed by your maintainer key, and publishes canon. "
                  + "Labels are applied." }
        : { tool: "issue_new", publish: false,
            args: { repo: t.repo, title: f.title ?? "", ...body, ...(labels.length ? { labels } : {} as Args) },
            what: "Sends the issue as a letter to the project's mailbox, signed by your identity. "
                  + "It appears once a maintainer accepts it. Labels are a request." };
    }
    case "comment":
      return role.maintainer
        ? { tool: "issue_reply", publish: true, args: { repo: t.repo, ...thread, body: f.body ?? "" },
            what: "Adds the comment straight to canon, signed by your maintainer key, and publishes canon." }
        : { tool: "issue_comment", publish: false, args: { repo: t.repo, ...thread, body: f.body ?? "" },
            what: "Sends the comment as a letter, signed by your identity. "
                  + "It appears once a maintainer accepts it." };
    case "pr":
      return { tool: "pr_new", publish: false,
               args: { repo: t.repo, title: f.title ?? "", ...body,
                       onto: f.onto || defaultOnto(role), ...(f.from ? { from: f.from } : {} as Args) },
               what: "Bundles the commits on the branch that are not on the target and sends them "
                     + "as a letter, signed by your identity. It appears once a maintainer accepts it." };
    case "close":
    case "reopen": {
      const note: Args = f.body?.trim() ? { note: f.body } : {};
      const what = t.kind === "pr" ? "pull request" : "issue";
      return { tool: op === "close" ? "issue_close" : "issue_reopen", publish: true,
               args: { repo: t.repo, ...thread, ...note },
               what: `${op === "close" ? "Closes" : "Reopens"} the ${what} in canon, signed by your maintainer key`
                     + (f.body?.trim() ? ", with your comment as the note" : "") + ", and publishes canon." };
    }
    case "label": {
      const labels = labelsOf(f.labels ?? "");
      return { tool: "issue_label", publish: true,
               args: { repo: t.repo, ...thread, ...(labels.length ? { labels } : { clear: true }) },
               what: labels.length
                 ? "Sets the labels to exactly these, in canon, signed by your maintainer key, and publishes canon."
                 : "Removes every label, in canon, signed by your maintainer key, and publishes canon." };
    }
    case "land":
      return { tool: "pr_land", publish: false,
               args: { repo: t.repo, number: t.number ?? 0,
                       ...(f.message?.trim() ? { message: f.message } : {}),
                       ...(f.noMirror ? { no_mirror: true } : {}) },
               what: "Merges the pull request with a merge commit, pushes the branch, records the merge "
                     + "in canon signed by your maintainer key, and publishes canon." };
  }
}

/** What a form is missing before it can be reviewed, or null. */
export function missing(op: Op, f: Form): string | null {
  if ((op === "issue" || op === "pr") && !f.title?.trim()) return "A title is needed.";
  if (op === "comment" && !f.body?.trim()) return "The comment is empty.";
  if (op === "pr" && f.from && f.onto && f.from === f.onto) return "A branch cannot be proposed onto itself.";
  return null;
}

/** The text a host answer carries: the verb's output, and what it said on the side. */
export function textOf(v: Json): { text: string; notes: string } {
  const o = obj(v);
  return { text: str(o?.["text"]) ?? (o ? JSON.stringify(o, null, 2) : String(v)), notes: str(o?.["notes"]) ?? "" };
}

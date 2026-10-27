// What a thread view offers to write, and the form each one opens. Shared by
// the view on GitHub and the extension's own thread page, so the two offer
// the same things the same way.
import type { ThreadViewOptions } from "./threadview.ts";

/** A draft is carried in the form's address, so it is bounded. */
export const DRAFT_MAX = 6000;

export function threadActions(o: {
  compose: (params: { [k: string]: string }) => void;
  key: string;
  gh: string;
  kind: "issue" | "pr";
  number: number;
  maintains: Promise<boolean>;
  knownLabels?: string[];
}): NonNullable<ThreadViewOptions["actions"]> {
  const base = { key: o.key, gh: o.gh, kind: o.kind, number: String(o.number) };
  const text = (s: string) => s.slice(0, DRAFT_MAX);
  return {
    comment: (draft) => o.compose({ op: "comment", ...base, body: text(draft) }),
    close: (note) => o.compose({ op: "close", ...base, body: text(note) }),
    reopen: (note) => o.compose({ op: "reopen", ...base, body: text(note) }),
    labels: (ls) => o.compose({ op: "label", ...base, labels: ls.join(", ") }),
    ...(o.kind === "pr" ? { land: () => o.compose({ op: "land", ...base }) } : {}),
    maintains: o.maintains,
    knownLabels: o.knownLabels ?? [],
  };
}

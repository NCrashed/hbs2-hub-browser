import type { IndexRow, LetterDoc } from "./docs.ts";

/**
 * The pull request an accepted letter belongs to. An open has no number until
 * canon accepts it, but its event id is already the stable thread id, so the
 * refreshed index can identify it without parsing CLI output or guessing by
 * title.
 */
export function acceptedPullNumber(letter: LetterDoc, pulls: IndexRow[]): number | null {
  if (letter.pr === null) return null;
  const subject = letter.subject;
  if (subject === null) return null;
  if (subject.number !== null) return subject.number;
  if (subject.thread === null) return null;
  for (const pull of pulls) {
    if (pull.kind !== "pr") continue;
    if (pull.thread_id === subject.thread) return pull.number;
  }
  return null;
}

export function acceptedPullUrl(repo: string, gh: string, number: number): string {
  return `thread.html?${new URLSearchParams({ key: repo, kind: "pr", number: String(number), ...(gh ? { gh } : {}) })}`;
}

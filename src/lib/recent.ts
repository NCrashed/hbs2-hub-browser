// The repositories this browser opened lately, for the web home page
// (PEP-25). A convenience of one browser, in its own storage: nothing the
// server keeps, and nothing breaks when storage is not there.
import { isRepoKey } from "./pointer.ts";

const KEY = "hbs2-hub-recent";
const MAX = 12;

export function recent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && isRepoKey(k)).slice(0, MAX) : [];
  } catch { return []; }
}

export function remember(key: string): void {
  if (!__WEB__ || !isRepoKey(key)) return;
  try { localStorage.setItem(KEY, JSON.stringify([key, ...recent().filter((k) => k !== key)].slice(0, MAX))); } catch { /* no storage */ }
}

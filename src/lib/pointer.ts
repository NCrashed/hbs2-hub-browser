// Which hbs2 repository a GitHub repository points at (PEP-24 ".hbs2/hub").

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Is this a repository key, as hbs2-hub writes one? */
export function isRepoKey(s: string): boolean {
  return BASE58.test(s);
}

/**
 * The key a `.hbs2/hub` file names, or null.
 *
 * Blank lines and lines starting with `#` are skipped; the first other line
 * is `hbs23://<key>` and nothing else is read. A file that says anything else
 * there names nothing, rather than something guessed.
 */
export function parsePointer(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = /^hbs23:\/\/(\S+)$/.exec(line);
    return m && m[1] && isRepoKey(m[1]) ? m[1] : null;
  }
  return null;
}

/** First path segments that are GitHub's own pages and never a repository owner. */
const NOT_OWNERS = new Set([
  "", "about", "apps", "codespaces", "collections", "contact", "customer-stories",
  "enterprise", "events", "explore", "features", "issues", "login", "logout",
  "marketplace", "new", "notifications", "orgs", "organizations", "pricing",
  "pulls", "search", "security", "settings", "signup", "site", "sponsors",
  "topics", "trending", "users",
]);

export interface GithubRepo {
  owner: string;
  repo: string;
  /**
   * What the page is: the repository, its issue list, its pull request list,
   * one of GitHub's own pull requests, one commit, or anything else in it.
   */
  view: "code" | "issues" | "pulls" | "pull" | "commit" | "other";
  /** For "pull": its number. */
  pull?: number;
  /** For "commit": its sha, as the address gives it. */
  commit?: string;
}

/** The repository a github.com path is inside, or null. */
export function repoFromPath(pathname: string): GithubRepo | null {
  const parts = pathname.split("/").filter((p) => p !== "");
  const [owner, repo, section, rest] = parts;
  if (!owner || !repo || NOT_OWNERS.has(owner.toLowerCase())) return null;
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  let view: GithubRepo["view"] = "other";
  if (section === undefined) view = "code";
  else if (section === "issues" && rest === undefined) view = "issues";
  else if (section === "pulls" && rest === undefined) view = "pulls";
  else if (section === "pull" && rest !== undefined && /^\d{1,9}$/.test(rest)) {
    return { owner, repo: repo.replace(/\.git$/, ""), view: "pull", pull: Number(rest) };
  } else if (section === "commit" && rest !== undefined && /^[0-9a-f]{7,64}$/.test(rest)) {
    return { owner, repo: repo.replace(/\.git$/, ""), view: "commit", commit: rest };
  }
  return { owner, repo: repo.replace(/\.git$/, ""), view };
}

/** Where the pointer of a repository is read from: public, no token. */
export function pointerUrl(r: GithubRepo): string {
  return `https://raw.githubusercontent.com/${r.owner}/${r.repo}/HEAD/.hbs2/hub`;
}

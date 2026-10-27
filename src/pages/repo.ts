// A repository's page: its hbs2 issues and pull requests, laid out as
// GitHub's repository pages are (PEP-24, PEP-25). The extension opens it from
// the "hbs2" tab; on the web it is a repository's home.
import { call, canWrite, open, pointer } from "../lib/client.ts";
import { roleOf } from "../lib/compose.ts";
import { asIndex, newerContract } from "../lib/docs.ts";
import type { IndexRow } from "../lib/docs.ts";
import { el, shortKey } from "../lib/dom.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { rowEl } from "../lib/rows.ts";
import { iconEl } from "../lib/threadview.ts";
import { siteBar } from "../lib/bar.ts";
import { aboutRepo, repoHeader } from "../lib/repohead.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
const gh = q.get("gh") ?? "";
const tab: "issue" | "pr" = q.get("tab") === "pulls" ? "pr" : "issue";
const state: "open" | "closed" = q.get("state") === "closed" ? "closed" : "open";

async function keyOf(): Promise<string | null> {
  const k = q.get("key");
  if (k && isRepoKey(k)) return k;
  if (__WEB__) return null;
  const m = gh ? /^([^/]+)\/([^/]+)$/.exec(gh) : null;
  if (!m || !m[1] || !m[2]) return null;
  return (await pointer(m[1], m[2])).key;
}

const here = (key: string, over: Record<string, string>) =>
  `repo.html?${new URLSearchParams({ key, ...(gh ? { gh } : {}), tab: tab === "pr" ? "pulls" : "issues", state, ...over })}`;

function list(key: string, rows: IndexRow[], writable: boolean): HTMLElement {
  const open_ = rows.filter((t) => t.status === "open");
  const closed = rows.filter((t) => t.status !== "open");
  const shown = state === "open" ? open_ : closed;
  const noun = tab === "pr" ? "pull request" : "issue";
  const make = writable ? el("button", { type: "button", class: "hbs2-btn is-primary" }, `New ${noun}`) : null;
  make?.addEventListener("click", () => void open("compose", { op: tab, key, gh }));
  return el("div", {},
    make ? el("div", { class: "hbs2-actions hbs2-newrow" }, make) : null,
    el("div", { class: "hbs2-listbox" },
      el("div", { class: "hbs2-listhead" },
        el("a", { href: here(key, { state: "open" }), class: state === "open" ? "is-selected" : "" },
          iconEl(tab === "pr" ? "pr-open" : "issue-open"), `${open_.length} Open`),
        el("a", { href: here(key, { state: "closed" }), class: state === "closed" ? "is-selected" : "" },
          iconEl(tab === "pr" ? "pr-merged" : "issue-closed"), `${closed.length} Closed`)),
      shown.length
        ? el("ul", { class: "hbs2-rows" }, ...shown.map((t) =>
            rowEl(t, tab, `thread.html?${new URLSearchParams({ key, kind: t.kind, number: String(t.number ?? ""), gh })}`)))
        : el("div", { class: "hbs2-empty" }, `No ${state} ${noun}s.`)));
}

async function main_(): Promise<void> {
  const key = await keyOf();
  siteBar(key);
  if (!key) {
    main.replaceChildren(el("p", {}, __WEB__
      ? "This link does not name a repository."
      : "This repository has no hbs2 side: no .hbs2/hub file and no mapping in the extension's options."));
    return;
  }
  document.title = `${gh || shortKey(key).textContent || key} \u00b7 hbs2-hub`;
  const progress = el("p", { class: "hbs2-muted" }, "loading");
  // The web build shows the repository's own name, from its manifest; the
  // extension has GitHub's.
  const about = __WEB__ ? await aboutRepo(key) : { name: null, description: null };
  const active = tab === "pr" ? "pulls" as const : "issues" as const;
  let head = repoHeader(key, about, active, { gh, code: __WEB__ });
  main.replaceChildren(head, progress);
  try {
    const writable = await canWrite();
    const [issues, prs, role] = await Promise.all([
      call("issue_list", { repo: key }, (p) => { progress.textContent = p; }).then(asIndex),
      call("pr_list", { repo: key }, (p) => { progress.textContent = p; }).then(asIndex),
      writable ? call("status", { repo: key, local: true }).then(roleOf, () => null) : Promise.resolve(null),
    ]);
    const maintainer = writable && role !== null && role.maintainer;
    const openOf = (rs: IndexRow[]) => rs.filter((t) => t.status === "open").length;
    head = repoHeader(key, about, active, { gh, code: __WEB__, maintainer,
                                            counts: { issues: openOf(issues.threads), pulls: openOf(prs.threads) } });
    main.replaceChildren(head, list(key, tab === "pr" ? prs.threads : issues.threads, writable));
    if (newerContract(issues)) head.after(el("p", { class: "warn" }, "The host speaks a newer contract than this page; update it."));
  } catch (e) {
    progress.textContent = e instanceof Error ? e.message : String(e);
  }
}

void main_();

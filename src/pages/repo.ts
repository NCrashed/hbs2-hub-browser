// A repository's page: its hbs2 issues and pull requests, laid out as
// GitHub's repository pages are (PEP-24, PEP-25). The extension opens it from
// the "hbs2" tab; on the web it is a repository's home.
import { call, canWrite, open, pointer } from "../lib/client.ts";
import { roleOf } from "../lib/compose.ts";
import { asIndex, newerContract } from "../lib/docs.ts";
import type { IndexRow } from "../lib/docs.ts";
import { el, shortKey } from "../lib/dom.ts";
import { identiconEl } from "../lib/identicon.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { rowEl } from "../lib/rows.ts";
import { iconEl } from "../lib/threadview.ts";
import { siteBar } from "../lib/bar.ts";

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

function tabs(key: string, issues: IndexRow[], prs: IndexRow[], maintainer: boolean): HTMLElement {
  const openCount = (rs: IndexRow[]) => String(rs.filter((t) => t.status === "open").length);
  const link = (label: string, icon: string, href: string, selected: boolean, count?: string) =>
    el("a", { href, class: selected ? "is-selected" : "" }, iconEl(icon), label,
      count !== undefined ? el("span", { class: "hbs2-tab-count" }, count) : null);
  return el("nav", { class: "hbs2-repo-tabs" },
    link("Issues", "issue-open", here(key, { tab: "issues", state: "open" }), tab === "issue", openCount(issues)),
    link("Pull requests", "pr-open", here(key, { tab: "pulls", state: "open" }), tab === "pr", openCount(prs)),
    maintainer ? link("Inbox", "comment", `inbox.html?${new URLSearchParams({ key, gh })}`, false) : null,
    maintainer ? link("Maintainers", "file", `maintainers.html?${new URLSearchParams({ key, gh })}`, false) : null);
}

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
  const head = el("div", { class: "hbs2-repo-head" },
    el("h1", {}, identiconEl(key, 24), " ", gh ? el("strong", {}, gh) : el("strong", { title: key }, shortKey(key))),
    el("code", { class: "hbs2-clone", title: "clone it" }, `git clone hbs23://${key}`));
  main.replaceChildren(head, progress);
  try {
    const writable = await canWrite();
    const [issues, prs, role] = await Promise.all([
      call("issue_list", { repo: key }, (p) => { progress.textContent = p; }).then(asIndex),
      call("pr_list", { repo: key }, (p) => { progress.textContent = p; }).then(asIndex),
      writable ? call("status", { repo: key, local: true }).then(roleOf, () => null) : Promise.resolve(null),
    ]);
    const maintainer = writable && role !== null && role.maintainer;
    main.replaceChildren(head, tabs(key, issues.threads, prs.threads, maintainer),
      list(key, tab === "pr" ? prs.threads : issues.threads, writable));
    if (newerContract(issues)) head.after(el("p", { class: "warn" }, "The host speaks a newer contract than this page; update it."));
  } catch (e) {
    progress.textContent = e instanceof Error ? e.message : String(e);
  }
}

void main_();

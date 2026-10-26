// On a GitHub repository page: find its hbs2 side and show it in place.
//
// READ-ONLY. This script runs beside a page anybody can put text on, so it
// never asks for a tool that writes (the background worker would refuse it
// anyway) and everything it adds is elements and text nodes. Threads open in
// the extension's own pages.
//
// GitHub's issue and pull request lists are drawn by React, which may redraw
// them at any moment. The hbs2 rows are therefore a list of their own, put right
// before GitHub's list inside the same panel rather than into it, and a tick
// puts back whatever a redraw took away. The data is fetched once per page.
import { repoFromPath } from "./lib/pointer.ts";
import type { GithubRepo } from "./lib/pointer.ts";
import { call, open, pointer } from "./lib/client.ts";
import type { Pointer } from "./lib/client.ts";
import { asIndex } from "./lib/docs.ts";
import type { IndexRow } from "./lib/docs.ts";
import { el } from "./lib/dom.ts";
import { ago, filterRows, parseQuery } from "./lib/query.ts";

const MARK = "data-hbs2-hub";

const pointers = new Map<string, Promise<Pointer>>();
const lists = new Map<string, Promise<IndexRow[]>>();

function mine(what: string, root: ParentNode = document): Element | null {
  return root.querySelector(`[${MARK}="${what}"]`);
}

async function run(): Promise<void> {
  const r = repoFromPath(location.pathname);
  if (!r) return;
  const listPage = r.view === "issues" || r.view === "pulls";
  const id = `${r.owner}/${r.repo}`.toLowerCase();
  if (!pointers.has(id)) pointers.set(id, pointer(r.owner, r.repo));
  const p = await pointers.get(id)!;
  if (!p.key) return;
  const key = p.key;
  const gh = `${r.owner}/${r.repo}`;

  if (!mine("tab")) addTab(key, gh);
  if (p.changed && !mine("warn")) warnChanged(p.changed);
  if (listPage) await addRows(r, key, gh);
}

// A tab in the repository's navigation, next to Issues and Pull requests.
function addTab(key: string, gh: string): void {
  const nav = document.querySelector("nav[aria-label='Repository'] ul, .UnderlineNav-body");
  if (!nav) return;
  const tab = el("a", { href: "#", [MARK]: "tab", class: "UnderlineNav-item hbs2-hub-tab", title: `hbs23://${key}` }, "hbs2");
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    void open("repo", { key, gh });
  });
  nav.append(nav.tagName === "UL" ? el("li", { class: "d-inline-flex" }, tab) : tab);
}

function warnChanged(named: string): void {
  const main = document.querySelector("main") ?? document.body;
  main.prepend(el("div", { [MARK]: "warn", class: "flash flash-warn hbs2-hub-box" },
    "hbs2: this repository's .hbs2/hub now names ", el("code", {}, named),
    ", not the key pinned when you first opened it. The pinned key is still used; change it in the extension's options if this is expected."));
}

async function rowsOf(key: string, kind: "issue" | "pr"): Promise<IndexRow[]> {
  const id = `${key}/${kind}`;
  if (!lists.has(id)) {
    const p = call(`${kind}_list`, { repo: key }).then((v) => asIndex(v).threads);
    p.catch(() => lists.delete(id));
    lists.set(id, p);
  }
  return lists.get(id)!;
}

// On /issues and /pulls: the hbs2 threads that answer the same search, in the
// same panel as GitHub's own, marked as hbs2.
async function addRows(r: GithubRepo, key: string, gh: string): Promise<void> {
  const kind = r.view === "pulls" ? "pr" : "issue";
  const list = document.querySelector('[data-listview-component="items-list"]');
  if (!list) return addBox(kind, key, gh);

  let all: IndexRow[];
  try {
    all = await rowsOf(key, kind);
  } catch (e) {
    if (!mine("rows")) list.before(el("div", { [MARK]: "rows", class: "hbs2-row hbs2-error" },
      "hbs2: ", e instanceof Error ? e.message : String(e)));
    return;
  }

  const q = parseQuery(new URLSearchParams(location.search).get("q"));
  const shown = filterRows(all, q);

  if (!mine("rows")) {
    const ul = el("ul", { [MARK]: "rows", class: "hbs2-rows", role: "list", "aria-label": "hbs2 threads" },
      ...shown.map((t) => rowEl(t, kind, key, gh)));
    list.before(ul);
  }

  // GitHub's "No results" contradicts rows right above it; hide it while there are some.
  const blank = list.querySelector('[role="status"]');
  if (blank instanceof HTMLElement && shown.length > 0 && blank.style.display !== "none") {
    blank.style.display = "none";
    blank.setAttribute(`${MARK}-hidden`, "");
  }

  countOnTabs(all);
}

function countOnTabs(all: IndexRow[]): void {
  const open_ = all.filter((t) => t.status === "open").length;
  const closed = all.length - open_;
  const container = document.querySelector('[id$="-list-view-container"]') ?? document;
  for (const a of container.querySelectorAll("a")) {
    const text = a.textContent?.trim() ?? "";
    const n = /^Open/.test(text) ? open_ : /^Closed/.test(text) ? closed : null;
    if (n === null || n === 0 || mine("count", a)) continue;
    a.append(el("span", { [MARK]: "count", class: "hbs2-count", title: "threads on hbs2" }, `+${n} hbs2`));
  }
}

function rowEl(t: IndexRow, kind: "issue" | "pr", key: string, gh: string): HTMLElement {
  const go = (e: Event) => {
    e.preventDefault();
    void open("thread", { key, kind, number: String(t.number ?? ""), gh });
  };
  const title = el("a", { href: "#", class: "hbs2-title" }, t.redacted ? "(redacted)" : t.title ?? "");
  title.addEventListener("click", go);
  return el("li", { class: "hbs2-row" },
    stateIcon(t.status),
    el("div", { class: "hbs2-main" },
      el("div", { class: "hbs2-head" },
        title,
        ...t.labels.map((l) => el("span", { class: "hbs2-label" }, l)),
        el("span", { class: "hbs2-badge", title: "this thread lives on hbs2, not on GitHub" }, "hbs2")),
      el("div", { class: "hbs2-meta" },
        `#${t.number ?? "?"} \u00b7 `, el("code", { title: t.author }, t.author.slice(0, 8)),
        ` opened ${ago(t.created_at)}`,
        t.updated_at > t.created_at ? `, updated ${ago(t.updated_at)}` : "")),
    el("div", { class: "hbs2-side", title: `${t.comments} comments` },
      t.comments > 0 ? commentIcon() : "", t.comments > 0 ? String(t.comments) : ""));
}

// Octicons (MIT, GitHub), drawn with the DOM API rather than parsed markup.
const ICONS: Record<string, string[]> = {
  open: ["M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
         "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"],
  closed: ["M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z",
           "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"],
  comment: ["M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"],
};

function svg(paths: string[], cls: string): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 16 16");
  s.setAttribute("width", "16");
  s.setAttribute("height", "16");
  if (cls) s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
}

function stateIcon(status: string): HTMLElement {
  const s = status === "open" ? "open" : "closed";
  return el("div", { class: `hbs2-icon ${status === "open" ? "is-open" : "is-done"}`, title: status }, svg(ICONS[s]!, ""));
}

function commentIcon(): SVGSVGElement {
  return svg(ICONS["comment"]!, "hbs2-comment-icon");
}

// When GitHub's list is not there (an older page layout), a box above the page.
async function addBox(kind: "issue" | "pr", key: string, gh: string): Promise<void> {
  if (mine("list")) return;
  const box = el("div", { [MARK]: "list", class: "Box hbs2-hub-box" },
    el("div", { class: "Box-header" }, `hbs2 ${kind === "pr" ? "pull requests" : "issues"}: loading`));
  const header = document.getElementById("repository-container-header");
  if (header) header.after(box);
  else (document.querySelector("main") ?? document.body).prepend(box);
  try {
    const rows = filterRows(await rowsOf(key, kind), parseQuery(new URLSearchParams(location.search).get("q")));
    box.replaceChildren(
      el("div", { class: "Box-header" }, `hbs2: ${rows.length} ${kind === "pr" ? "pull requests" : "issues"}`),
      el("ul", { class: "hbs2-rows" }, ...rows.map((t) => rowEl(t, kind, key, gh))));
  } catch (e) {
    box.replaceChildren(el("div", { class: "Box-header" }, "hbs2: ", e instanceof Error ? e.message : String(e)));
  }
}

// Every second: on a new page (GitHub changes the URL without reloading,
// including when the search or the Open/Closed tab changes), take ours off;
// then put back whatever is missing.
let running = false;
let last = location.pathname + location.search;
function tick(): void {
  if (running) return;
  const here = location.pathname + location.search;
  if (here !== last) {
    last = here;
    for (const e of document.querySelectorAll(`[${MARK}]`)) e.remove();
    for (const e of document.querySelectorAll(`[${MARK}-hidden]`)) {
      (e as HTMLElement).style.display = "";
      e.removeAttribute(`${MARK}-hidden`);
    }
  }
  running = true;
  void run().finally(() => { running = false; });
}
tick();
setInterval(tick, 1000);

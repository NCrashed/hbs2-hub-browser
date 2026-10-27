// On a GitHub repository page: find its hbs2 side and show it in place.
//
// READ-ONLY. This script runs beside a page anybody can put text on, so it
// never asks for a tool that writes (the background worker would refuse it
// anyway) and everything it adds is elements and text nodes. Its buttons that
// write open the extension's own form, where the person reviews what will be
// signed; a draft typed here is carried there and shown again.
//
// GitHub's issue and pull request lists are drawn by React, which may redraw
// them at any moment. The hbs2 rows are therefore a list of their own, put right
// before GitHub's list inside the same panel rather than into it, and a tick
// puts back whatever a redraw took away. The data is fetched once per page.
import { repoFromPath } from "./lib/pointer.ts";
import type { GithubRepo } from "./lib/pointer.ts";
import { call, open, pointer } from "./lib/client.ts";
import type { Pointer } from "./lib/client.ts";
import { asIndex, asThread } from "./lib/docs.ts";
import type { IndexRow } from "./lib/docs.ts";
import { roleOf } from "./lib/compose.ts";
import type { TabNote } from "./lib/protocol.ts";
import { el } from "./lib/dom.ts";
import { ago, filterRows, parseQuery } from "./lib/query.ts";
import { iconEl, stateLook, threadView } from "./lib/threadview.ts";

const MARK = "data-hbs2-hub";

const pointers = new Map<string, Promise<Pointer>>();
const lists = new Map<string, Promise<IndexRow[]>>();
const maintains = new Map<string, Promise<boolean>>();

// Whether the working clone signs as a maintainer, asked without the network.
function canLand(key: string): Promise<boolean> {
  if (!maintains.has(key)) {
    const p = call("status", { repo: key, local: true }).then((v) => roleOf(v).maintainer, () => false);
    maintains.set(key, p);
  }
  return maintains.get(key)!;
}

// A draft is carried in the form's address, so it is bounded.
const DRAFT_MAX = 6000;

function compose(params: { [k: string]: string }): void {
  void open("compose", params);
}

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
  const route = routeOf(location.hash);
  if (listPage && route) await showThread(route, key, gh);
  else {
    hideThread();
    if (listPage) await addRows(r, key, gh);
  }
}

// A thread is shown in place, under GitHub's own header, at `#hbs2/<kind>/<number>`
// on the issues or pulls page: the address can be shared and the browser's back
// button returns to the list.
interface Route { kind: "issue" | "pr"; number: number }

function routeOf(hash: string): Route | null {
  const m = /^#hbs2\/(issue|pr)\/(\d{1,9})$/.exec(hash);
  return m ? { kind: m[1] as "issue" | "pr", number: Number(m[2]) } : null;
}

// The part of the page GitHub draws the list in; hidden while a thread is shown.
function listApp(): HTMLElement | null {
  // The app that draws the list, found from the list itself first: the page
  // around it differs between a signed-in and a signed-out view.
  const list = document.querySelector('[data-listview-component="items-list"]');
  return (list?.closest("react-app") as HTMLElement | null)
    ?? document.querySelector<HTMLElement>("#repo-content-pjax-container react-app")
    ?? (list?.closest('[data-testid="issues-list-surface"]') as HTMLElement | null)
    ?? document.querySelector<HTMLElement>("main react-app");
}

async function showThread(route: Route, key: string, gh: string): Promise<void> {
  const id = `${route.kind}/${route.number}`;
  const shown = mine("thread-host");
  if (shown && shown.getAttribute("data-route") === id) return;
  shown?.remove();
  const app = listApp();
  if (app) {
    app.style.display = "none";
    app.setAttribute(`${MARK}-hidden`, "");
  } else console.warn("hbs2-hub: no list app found on this page; drawing the thread at the top");
  const host = el("div", { [MARK]: "thread-host", "data-route": id },
    el("div", { class: "hbs2-thread hbs2-muted" }, "Loading the thread from hbs2"));
  if (app) app.after(host);
  else (document.querySelector("main") ?? document.body).prepend(host);
  try {
    const t = asThread(await call(`${route.kind}_show`, { repo: key, number: route.number }));
    document.title = `${t.title ?? ""} \u00b7 hbs2 #${t.number ?? "?"} \u00b7 ${gh}`;
    const n = String(route.number);
    host.replaceChildren(threadView(t, {
      repo: key,
      back: { label: route.kind === "pr" ? "Pull requests" : "Issues", go: () => leaveThread() },
      actions: {
        comment: (draft) => compose({ op: "comment", key, gh, kind: route.kind, number: n, body: draft.slice(0, DRAFT_MAX) }),
        ...(route.kind === "pr" ? { land: () => compose({ op: "land", key, gh, number: n }), canLand: canLand(key) } : {}),
      },
    }));
  } catch (e) {
    host.replaceChildren(el("div", { class: "hbs2-thread" }, "hbs2: ", e instanceof Error ? e.message : String(e)));
  }
}

// The route goes into the address with pushState, NOT by setting location.hash.
// GitHub's router listens for hashchange and popstate and, on a signed-in page,
// answers a hash it does not know by navigating back to the plain list, which
// took the thread away as soon as it was opened. pushState fires neither event,
// so the router is not told; the back button still fires popstate, with the
// address of the list, and the tick then hides the thread.
// Whether the thread's history entry is ours: only then does "back" mean
// history.back(); a thread opened from a link goes to the list instead.
let pushed = false;

function enterThread(kind: "issue" | "pr", number: number): void {
  pushed = true;
  history.pushState(history.state, "", `${location.pathname}${location.search}#hbs2/${kind}/${number}`);
  window.scrollTo(0, 0);
  tick();
}

function leaveThread(): void {
  if (pushed && routeOf(location.hash)) { pushed = false; history.back(); }
  else {
    history.pushState(history.state, "", `${location.pathname}${location.search}`);
    tick();
  }
}

function hideThread(): void {
  const host = mine("thread-host");
  if (!host) return;
  host.remove();
  for (const e of document.querySelectorAll(`[${MARK}-hidden]`)) {
    (e as HTMLElement).style.display = "";
    e.removeAttribute(`${MARK}-hidden`);
  }
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
      barEl(kind, key, gh, shown.length),
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

// The first line of the hbs2 rows: how many, and the button that files one.
function barEl(kind: "issue" | "pr", key: string, gh: string, n: number): HTMLElement {
  const go = el("button", { type: "button", class: "hbs2-btn is-primary hbs2-new" },
    kind === "pr" ? "New pull request on hbs2" : "New issue on hbs2");
  go.addEventListener("click", () => compose({ op: kind, key, gh }));
  return el("li", { class: "hbs2-bar" },
    el("span", { class: "hbs2-badge" }, "hbs2"),
    el("span", { class: "hbs2-muted" },
      `${n} ${kind === "pr" ? "pull request" : "issue"}${n === 1 ? "" : "s"} on hbs2 for this search`),
    go);
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
    // A middle click or ctrl-click keeps its meaning: the href is the same route.
    if (e instanceof MouseEvent && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey)) return;
    e.preventDefault();
    enterThread(kind, t.number ?? 0);
  };
  const title = el("a", { href: `#hbs2/${kind}/${t.number ?? ""}`, class: "hbs2-title" }, t.redacted ? "(redacted)" : t.title ?? "");
  title.addEventListener("click", go);
  return el("li", { class: "hbs2-row" },
    stateIcon(kind, t.status),
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

function stateIcon(kind: "issue" | "pr", status: string): HTMLElement {
  const look = stateLook(kind, status);
  return el("div", { class: `hbs2-icon ${look.cls}`, title: status }, iconEl(look.icon));
}

function commentIcon(): SVGSVGElement {
  const s = iconEl("comment");
  s.setAttribute("class", "hbs2-comment-icon");
  return s;
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
addEventListener("popstate", () => tick());

// A form finished writing: fetch again and draw again, where we are.
chrome.runtime.onMessage.addListener((m: TabNote) => {
  if (m?.kind !== "hbs2-changed") return;
  lists.clear();
  maintains.delete(m.key);
  mine("thread-host")?.remove();
  mine("rows")?.remove();
  for (const e of document.querySelectorAll(`[${MARK}="count"]`)) e.remove();
  tick();
});

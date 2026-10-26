// On a GitHub repository page: find its hbs2 side, and show where it is.
//
// READ-ONLY. This script runs beside a page anybody can put text on, so it
// never asks for a tool that writes (the background worker would refuse it
// anyway) and it puts nothing on the page but a tab, a small box and lines of
// text. Threads open in the extension's own pages.
import { repoFromPath } from "./lib/pointer.ts";
import type { GithubRepo } from "./lib/pointer.ts";
import { call, open, pointer } from "./lib/client.ts";
import type { Pointer } from "./lib/client.ts";
import { asIndex } from "./lib/docs.ts";
import { el } from "./lib/dom.ts";

const MARK = "data-hbs2-hub";

// Asked once per repository per page load: the tick below runs every second.
const pointers = new Map<string, Promise<Pointer>>();

async function run(): Promise<void> {
  const r = repoFromPath(location.pathname);
  if (!r) return;
  const needTab = !mine("tab");
  const needList = (r.view === "issues" || r.view === "pulls") && !mine("list");
  if (!needTab && !needList) return;

  const id = `${r.owner}/${r.repo}`.toLowerCase();
  if (!pointers.has(id)) pointers.set(id, pointer(r.owner, r.repo));
  const p = await pointers.get(id)!;
  if (!p.key) return;
  const key = p.key;
  const gh = `${r.owner}/${r.repo}`;

  if (needTab) addTab(key, gh);
  if (p.changed && !mine("warn")) warnChanged(p.changed);
  if (needList) await addList(r, key, gh);
}

function mine(what: string): boolean {
  return document.querySelector(`[${MARK}="${what}"]`) !== null;
}

// A tab in the repository's navigation, next to Issues and Pull requests.
function addTab(key: string, gh: string): void {
  const nav = document.querySelector("nav[aria-label='Repository'] ul, .UnderlineNav-body");
  const tab = el("a", { href: "#", [MARK]: "tab", class: "UnderlineNav-item hbs2-hub-tab", title: `hbs23://${key}` }, "hbs2");
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    void open("repo", { key, gh });
  });
  if (nav) nav.append(nav.tagName === "UL" ? el("li", { class: "d-inline-flex" }, tab) : tab);
}

function warnChanged(named: string): void {
  const main = document.querySelector("main") ?? document.body;
  main.prepend(el("div", { [MARK]: "warn", class: "flash flash-warn hbs2-hub-box" },
    "hbs2: this repository's .hbs2/hub now names ", el("code", {}, named),
    ", not the key pinned when you first opened it. The pinned key is still used; change it in the extension's options if this is expected."));
}

// On /issues and /pulls: the hbs2 threads of the same kind, above GitHub's own list.
async function addList(r: GithubRepo, key: string, gh: string): Promise<void> {
  const kind = r.view === "pulls" ? "pr" : "issue";
  const box = el("div", { [MARK]: "list", class: "Box hbs2-hub-box" },
    el("div", { class: "Box-header" }, `hbs2 ${kind === "pr" ? "pull requests" : "issues"}: loading`));
  // Under the repository header, so it sits above GitHub's own list. The
  // header has a stable id; without it, the top of main.
  const header = document.getElementById("repository-container-header");
  if (header) header.after(box);
  else (document.querySelector("main") ?? document.body).prepend(box);
  try {
    const doc = asIndex(await call(`${kind}_list`, { repo: key, status: "open" }));
    const rows = doc.threads;
    box.replaceChildren(
      el("div", { class: "Box-header" },
        `hbs2: ${rows.length} open ${kind === "pr" ? "pull requests" : "issues"} `,
        link("view all", () => open("repo", { key, gh }))),
      ...rows.slice(0, 20).map((t) =>
        el("div", { class: "Box-row" },
          link(`#${t.number ?? "?"} ${t.redacted ? "(redacted)" : t.title ?? ""}`,
               () => open("thread", { key, kind, number: String(t.number ?? ""), gh })),
          t.labels.length ? el("span", { class: "hbs2-hub-labels" }, " ", t.labels.join(", ")) : null)),
    );
    if (rows.length === 0) box.append(el("div", { class: "Box-row color-fg-muted" }, "none open"));
  } catch (e) {
    box.replaceChildren(el("div", { class: "Box-header" }, "hbs2: ", e instanceof Error ? e.message : String(e)));
  }
}

function link(text: string, go: () => unknown): HTMLElement {
  const a = el("a", { href: "#" }, text);
  a.addEventListener("click", (e) => {
    e.preventDefault();
    void go();
  });
  return a;
}

// GitHub navigates without reloading, and re-renders its header after load,
// which can take the tab away with it. So every second: on a new path, take
// ours off the page; then put back whatever is missing. The pointer is cached,
// so a tick that has nothing to do costs a query selector.
let running = false;
let lastPath = location.pathname;
function tick(): void {
  if (running) return;
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    for (const e of document.querySelectorAll(`[${MARK}]`)) e.remove();
  }
  running = true;
  void run().finally(() => { running = false; });
}
tick();
setInterval(tick, 1000);

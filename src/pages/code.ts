// A repository's code, as GitHub shows it (PEP-25): a directory with its
// README, a file, the history, a commit with its diff. The web build's
// repository home; the extension has GitHub's own for this.
//
// Every name, path, message and byte here is the repository's, which is to
// say a stranger's: text nodes and the extension's own Markdown reader, and a
// file is shown as text in a table, never handed to the browser as a document.
import { call, canWrite } from "../lib/client.ts";
import { roleOf } from "../lib/compose.ts";
import { asIndex } from "../lib/docs.ts";
import { siteBar } from "../lib/bar.ts";
import { remember } from "../lib/recent.ts";
import { parseDiff } from "../lib/diff.ts";
import { el, markdownEl, shortKey } from "../lib/dom.ts";
import { identiconEl } from "../lib/identicon.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { ago } from "../lib/query.ts";
import { aboutOf, repoHeader } from "../lib/repohead.ts";
import { fileBox, iconEl } from "../lib/threadview.ts";
import type { Json } from "../lib/protocol.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
const key = q.get("key") ?? "";
const view = q.get("view") ?? "tree";
const path = (q.get("path") ?? "").replace(/^\/+|\/+$/g, "");
siteBar(isRepoKey(key) ? key : null);

type Obj = { [k: string]: Json };
const obj = (v: Json | undefined): Obj => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");
const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const present = (xs: (HTMLElement | null)[]): HTMLElement[] => xs.filter((x): x is HTMLElement => x !== null);

function href(over: Record<string, string>): string {
  const p = new URLSearchParams({ key });
  for (const [k, v] of Object.entries(over)) if (v) p.set(k, v);
  return `code.html?${p}`;
}

function crumbs(ref: string, at: string, file: boolean): HTMLElement {
  const parts = at ? at.split("/") : [];
  const out: (Node | string)[] = [el("a", { href: href({ ref }) }, "root")];
  parts.forEach((p, i) => {
    out.push(" / ");
    const sub = parts.slice(0, i + 1).join("/");
    out.push(i === parts.length - 1 && file ? el("strong", {}, p)
      : el("a", { href: href({ ref, path: sub }) }, p));
  });
  return el("div", { class: "hbs2-crumbs" }, ...out);
}

function branchPicker(refs: Obj, ref: string): HTMLElement {
  const names = [...arr(refs["branches"]).map((b) => str(obj(b)["name"])), ...arr(refs["tags"]).map((t) => str(obj(t)["name"]))];
  const s = el("select", { class: "hbs2-input hbs2-branchpick", "aria-label": "branch or tag" });
  for (const n of names.includes(ref) ? names : [ref, ...names]) {
    const opt = el("option", { value: n }, n);
    if (n === ref) opt.selected = true;
    s.append(opt);
  }
  s.addEventListener("change", () => { location.href = href({ ref: s.value, path: view === "tree" || view === "commits" ? path : "", view: view === "commits" ? "commits" : "" }); });
  return el("label", { class: "hbs2-branchwrap" }, iconEl("branch"), s);
}

// The newest commit that touched this place, as GitHub's box above a listing.
function lastCommit(c: Obj, ref: string, total: unknown): HTMLElement {
  const author = obj(c["author"]);
  const oid = str(c["oid"]);
  return el("div", { class: "hbs2-lastcommit" },
    el("strong", {}, el("bdi", {}, str(author["name"]))), " ",
    el("a", { href: href({ view: "commit", commit: oid }), class: "hbs2-subject" }, el("bdi", {}, str(c["subject"]))),
    el("span", { class: "hbs2-spacer" }),
    el("a", { href: href({ view: "commit", commit: oid }) }, el("code", {}, oid.slice(0, 7))),
    typeof c["committed_at"] === "number" ? el("span", { class: "hbs2-muted" }, ` \u00b7 ${ago(c["committed_at"])}`) : null,
    el("a", { href: href({ view: "commits", ref, path }), class: "hbs2-history" }, iconEl("history"), ` ${countText(total) ?? "History"}`));
}

// "1,234 commits", as GitHub's, or nothing when the server did not say.
function countText(total: unknown): string | null {
  return typeof total === "number" ? `${total.toLocaleString("en-US")} ${total === 1 ? "commit" : "commits"}` : null;
}

function readme(name: string, text: string): HTMLElement {
  const md = /\.(md|markdown)$/i.test(name) || !/\./.test(name);
  return el("div", { class: "hbs2-readme" },
    el("div", { class: "hbs2-readme-head" }, iconEl("file"), el("strong", {}, name)),
    md ? el("div", { class: "hbs2-md hbs2-readme-body" }, markdownEl(text)) : el("pre", { class: "hbs2-readme-body" }, text));
}

async function treeView(refs: Obj, ref: string): Promise<HTMLElement[]> {
  const [tree, log] = await Promise.all([
    call("code_tree", { repo: key, ref, ...(path ? { path } : {}) }).then(obj),
    call("code_log", { repo: key, ref, limit: 1, ...(path ? { path } : {}) }).then(obj),
  ]);
  const entries = arr(tree["entries"]).map(obj);
  const top = arr(log["commits"]).map(obj)[0];
  const rows = entries.map((e) => {
    const name = str(e["name"]);
    const type = str(e["type"]);
    const sub = path ? `${path}/${name}` : name;
    const link = type === "tree" ? el("a", { href: href({ ref, path: sub }) }, name)
      : type === "blob" ? el("a", { href: href({ ref, path: sub, view: "blob" }) }, name)
      : el("span", { class: "hbs2-muted", title: "a submodule" }, `${name} @ ${str(e["oid"]).slice(0, 7)}`);
    return el("tr", {},
      el("td", { class: "hbs2-ficon" }, iconEl(type === "tree" ? "dir" : "file")),
      el("td", {}, link),
      el("td", { class: "hbs2-muted hbs2-fsize" }, typeof e["size"] === "number" ? sizeText(e["size"]) : ""));
  });
  const parts: HTMLElement[] = [
    el("div", { class: "hbs2-codebar" }, branchPicker(refs, ref), crumbs(ref, path, false)),
    el("div", { class: "hbs2-filebox" },
      top ? lastCommit(top, ref, log["total"]) : el("div", { class: "hbs2-lastcommit hbs2-muted" }, "No commits."),
      rows.length ? el("table", { class: "hbs2-files-table" }, el("tbody", {},
        ...(path ? [el("tr", {}, el("td", { class: "hbs2-ficon" }), el("td", {},
          el("a", { href: href({ ref, path: path.split("/").slice(0, -1).join("/") }) }, "..")), el("td", {}))] : []),
        ...rows)) : el("div", { class: "hbs2-empty" }, "An empty directory.")),
  ];
  const rd = str(tree["readme"]);
  if (rd) {
    const blob = obj(await call("code_blob", { repo: key, ref, path: path ? `${path}/${rd}` : rd }));
    if (!blob["binary"]) parts.push(readme(rd, str(blob["text"])));
  }
  return parts;
}

function sizeText(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function blobView(refs: Obj, ref: string): Promise<HTMLElement[]> {
  const blob = obj(await call("code_blob", { repo: key, ref, path }));
  const text = str(blob["text"]);
  const name = path.split("/").pop() ?? path;
  const lines = text.replace(/\n$/, "").split("\n");
  const md = /\.(md|markdown)$/i.test(name);
  const body = el("div", {});
  const asSource = () => body.replaceChildren(el("table", { class: "hbs2-blob" }, el("tbody", {},
    ...lines.map((l, i) => el("tr", {}, el("td", { class: "hbs2-ln" }, String(i + 1)), el("td", { class: "hbs2-code" }, l))))));
  const asPreview = () => body.replaceChildren(el("div", { class: "hbs2-md hbs2-readme-body" }, markdownEl(text)));
  let toggle: HTMLElement | null = null;
  if (blob["binary"]) body.replaceChildren(el("div", { class: "hbs2-empty" }, "A binary file, not shown."));
  else if (md) {
    const pre = el("button", { type: "button", class: "hbs2-etab is-selected" }, "Preview");
    const src = el("button", { type: "button", class: "hbs2-etab" }, "Code");
    pre.addEventListener("click", () => { asPreview(); pre.classList.add("is-selected"); src.classList.remove("is-selected"); });
    src.addEventListener("click", () => { asSource(); src.classList.add("is-selected"); pre.classList.remove("is-selected"); });
    toggle = el("span", { class: "hbs2-etabs hbs2-inline-tabs" }, pre, src);
    asPreview();
  } else asSource();
  return present([
    el("div", { class: "hbs2-codebar" }, branchPicker(refs, ref), crumbs(ref, path, true)),
    el("div", { class: "hbs2-filebox" },
      el("div", { class: "hbs2-filehead" }, toggle,
        el("span", { class: "hbs2-muted" },
          blob["binary"] ? "" : `${lines.length} lines \u00b7 `, typeof blob["size"] === "number" ? sizeText(blob["size"]) : ""),
        el("span", { class: "hbs2-spacer" }),
        el("a", { href: href({ view: "commits", ref, path }), class: "hbs2-history" }, iconEl("history"), " History")),
      blob["truncated"] ? el("div", { class: "hbs2-flash" }, "Only the first 512 KiB of this file is shown. Clone the repository for the rest.") : null,
      body),
  ]);
}

async function commitsView(refs: Obj, ref: string): Promise<HTMLElement[]> {
  const skip = Number(q.get("skip") ?? "0") || 0;
  const page = obj(await call("code_log", { repo: key, ref, limit: 30, ...(skip > 0 ? { skip } : {}), ...(path ? { path } : {}) }));
  const commits = arr(page["commits"]).map(obj);
  const rows = commits.map((c) => {
    const a = obj(c["author"]);
    const oid = str(c["oid"]);
    return el("li", { class: "hbs2-row" },
      el("div", { class: "hbs2-main" },
        el("div", { class: "hbs2-head" }, el("a", { href: href({ view: "commit", commit: oid }), class: "hbs2-title" }, el("bdi", {}, str(c["subject"])))),
        el("div", { class: "hbs2-meta" }, el("bdi", {}, str(a["name"])),
          typeof c["committed_at"] === "number" ? ` committed ${ago(c["committed_at"])}` : "")),
      el("div", { class: "hbs2-side" }, el("a", { href: href({ view: "commit", commit: oid }) }, el("code", {}, oid.slice(0, 7)))));
  });
  const total = page["total"];
  const more = typeof total === "number" ? skip + commits.length < total : commits.length === 30;
  const older = more ? el("a", { href: href({ view: "commits", ref, path, skip: String(skip + 30) }), class: "hbs2-btn" }, "Older") : null;
  const newer = skip > 0 ? el("a", { href: href({ view: "commits", ref, path, skip: String(Math.max(0, skip - 30)) }), class: "hbs2-btn" }, "Newer") : null;
  return [
    el("div", { class: "hbs2-codebar" }, branchPicker(refs, ref), el("h2", { class: "hbs2-commits-title" }, "Commits", path ? el("span", { class: "hbs2-muted" }, ` on ${path}`) : null,
      countText(total) ? el("span", { class: "hbs2-muted hbs2-small" }, ` \u00b7 ${countText(total)}`) : null)),
    el("div", { class: "hbs2-listbox" }, rows.length ? el("ul", { class: "hbs2-rows" }, ...rows) : el("div", { class: "hbs2-empty" }, "No commits.")),
    el("div", { class: "hbs2-actions" }, newer, older),
  ];
}

async function commitView(): Promise<HTMLElement[]> {
  const c = obj(await call("code_commit", { repo: key, commit: q.get("commit") ?? "" }));
  const a = obj(c["author"]);
  const message = str(c["message"]).trim();
  const [subject, ...rest] = message.split("\n");
  const diff = obj(c["diff"]);
  const files = parseDiff(str(diff["text"]));
  const adds = files.reduce((n, f) => n + f.adds, 0);
  const dels = files.reduce((n, f) => n + f.dels, 0);
  return present([
    el("div", { class: "hbs2-commit-head" },
      el("h1", {}, el("bdi", {}, subject ?? "")),
      rest.join("\n").trim() ? el("pre", { class: "hbs2-commit-msg" }, rest.join("\n").trim()) : null,
      el("div", { class: "hbs2-commit-meta" },
        identiconEl(str(a["email"]) || str(a["name"]), 20), " ",
        el("strong", {}, el("bdi", {}, str(a["name"]))),
        typeof c["authored_at"] === "number" ? ` committed ${ago(c["authored_at"])}` : "",
        el("span", { class: "hbs2-spacer" }),
        ...arr(c["parents"]).map((p) => el("span", { class: "hbs2-muted" }, " parent ",
          el("a", { href: href({ view: "commit", commit: str(p) }) }, el("code", {}, str(p).slice(0, 7))))),
        " ", el("code", { title: str(c["oid"]) }, str(c["oid"]).slice(0, 7)))),
    el("div", { class: "hbs2-tabs" }, el("span", { class: "hbs2-muted" }, `${files.length} file${files.length === 1 ? "" : "s"} changed`),
      el("span", { class: "hbs2-diffstat" }, el("span", { class: "hbs2-add" }, `+${adds}`), " ", el("span", { class: "hbs2-del" }, `-${dels}`))),
    diff["truncated"] ? el("div", { class: "hbs2-flash" }, "The diff is cut at 512 KiB; clone the repository for the rest.") : null,
    el("div", { class: "hbs2-files" }, ...files.map(fileBox)),
  ]);
}

async function main_(): Promise<void> {
  if (!isRepoKey(key)) { main.replaceChildren(el("p", {}, "This link does not name a repository.")); return; }
  remember(key);
  const progress = el("p", { class: "hbs2-muted" }, "loading");
  main.replaceChildren(progress);
  try {
    const refs = obj(await call("code_refs", { repo: key }, (p) => { progress.textContent = p; }));
    const about = aboutOf(refs);
    document.title = `${about.name ?? shortKey(key).textContent ?? key} \u00b7 hbs2-hub`;
    const ref = q.get("ref") || str(refs["head"]) || "HEAD";
    // The tabs as on the issue page: the counts, and for a maintainer of a
    // local server the inbox and the maintainers. None of it holds the page up.
    const openIn = (tool: string) => call(tool, { repo: key }).then((v) => asIndex(v).threads.filter((t) => t.status === "open").length, () => undefined);
    const [issues, pulls, maintainer] = await Promise.all([openIn("issue_list"), openIn("pr_list"),
      canWrite().then((w) => w ? call("status", { repo: key, local: true }).then((v) => roleOf(v).maintainer, () => false) : false)]);
    const head = repoHeader(key, about, "code", { code: true, maintainer,
                                                 counts: { ...(issues !== undefined ? { issues } : {}), ...(pulls !== undefined ? { pulls } : {}) } });
    const body = view === "blob" ? await blobView(refs, ref)
      : view === "commits" ? await commitsView(refs, ref)
      : view === "commit" ? await commitView()
      : await treeView(refs, ref);
    main.replaceChildren(head, ...body);
  } catch (e) {
    main.replaceChildren(el("div", { class: "hbs2-flash is-error" }, e instanceof Error ? e.message : String(e)));
  }
}

void main_();

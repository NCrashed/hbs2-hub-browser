// Who may write canon: the owner and the maintainers canon names, and for the
// owner, adding and removing them (PEP-21). An extension page, so it writes;
// every write is rehearsed in place first (rehearse.ts).
import { call, changed } from "../lib/client.ts";
import { roleOf } from "../lib/compose.ts";
import { el, shortKey } from "../lib/dom.ts";
import { identiconEl } from "../lib/identicon.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { CANON_WARN, refusal, rehearse } from "../lib/rehearse.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
const repo = q.get("key") ?? "";
const gh = q.get("gh") ?? "";
const tabText = q.get("tab");
const tab = tabText && /^\d{1,12}$/.test(tabText) ? Number(tabText) : null;

interface Maintainer { key: string; owner: boolean }

function maintainersOf(v: unknown): Maintainer[] {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  if (!o || o["document"] !== "maintainers" || !Array.isArray(o["maintainers"])) throw new Error("the host did not return a maintainers document");
  return (o["maintainers"] as unknown[]).flatMap((m) => {
    const r = m && typeof m === "object" ? (m as Record<string, unknown>) : null;
    return r && typeof r["key"] === "string" ? [{ key: r["key"], owner: r["owner"] === true }] : [];
  });
}

function header(): HTMLElement {
  return el("div", { class: "hbs2-c-header hbs2-inbox-head" },
    el("div", {},
      el("h1", {}, "Maintainers"),
      el("p", { class: "hbs2-muted" }, gh ? `${gh} \u00b7 ` : "", "hbs23://", shortKey(repo))),
    el("a", { href: `inbox.html?${new URLSearchParams({ key: repo, gh })}`, class: "hbs2-btn" }, "Inbox"));
}

function row(m: Maintainer, me: string | null): HTMLElement {
  const result = el("div", { class: "hbs2-confirm" });
  const remove = m.owner ? null : el("button", { type: "button", class: "hbs2-btn hbs2-small-btn" }, "Remove");
  const line = el("div", { class: "hbs2-card" },
    el("div", { class: "hbs2-card-head hbs2-static" }, identiconEl(m.key, 32),
      el("span", { class: "hbs2-card-title" },
        el("code", { class: "hbs2-fullkey" }, m.key),
        el("span", { class: "hbs2-muted hbs2-small" },
          m.owner ? "the owner: the repository key itself" : "maintainer", m.key === me ? " \u00b7 this clone signs as it" : "")),
      remove),
    el("div", { class: "hbs2-card-panel" }, result));
  remove?.addEventListener("click", async () => {
    remove.disabled = true;
    const out = await rehearse(result, {
      tool: "maintainer_remove", args: { repo, key: m.key }, publish: repo, sign: "Remove and publish",
      warn: "What this key wrote stays in canon; from now on it may not bless anything. " + CANON_WARN });
    if (out === null) { remove.disabled = false; return; }
    await changed(tab, repo).catch(() => {});
    void load();
  });
  return line;
}

function adder(): HTMLElement {
  const input = el("input", { class: "hbs2-input", placeholder: "A key (base58), or #N for the author of thread N" });
  const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Add");
  const result = el("div", { class: "hbs2-confirm" });
  const err = el("div", {});
  go.addEventListener("click", async () => {
    const v = input.value.trim();
    const byThread = /^#?(\d{1,9})$/.exec(v);
    const args: { [k: string]: string | number } | null = byThread ? { repo, author_of: Number(byThread[1]) }
      : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) ? { repo, key: v } : null;
    if (!args) { err.replaceChildren(el("div", { class: "hbs2-flash is-error" }, "A key, or #N for the author of thread N.")); return; }
    err.replaceChildren();
    go.disabled = true;
    const out = await rehearse(result, {
      tool: "maintainer_add", args, publish: repo, sign: "Add and publish",
      warn: "A maintainer may accept letters and write canon. " + CANON_WARN });
    go.disabled = false;
    if (out === null) return;
    await changed(tab, repo).catch(() => {});
    void load();
  });
  return el("div", { class: "hbs2-adder" },
    el("h2", {}, "Add a maintainer"),
    el("p", { class: "hbs2-muted hbs2-small" },
      "Usually somebody who has sent issues or pull requests already: #N takes the author of that thread. "
      + "Publishing canon still needs push access to the repository, which this does not give."),
    el("div", { class: "hbs2-actions hbs2-answer-row" }, input, go), err, result);
}

async function load(): Promise<void> {
  if (!isRepoKey(repo)) {
    main.replaceChildren(el("p", {}, "This link does not name a repository."));
    return;
  }
  main.replaceChildren(header(), el("p", { class: "hbs2-muted" }, "Reading canon"));
  try {
    const [role, ms] = await Promise.all([
      call("status", { repo, local: true }).then(roleOf),
      call("maintainer_list", { repo }).then(maintainersOf),
    ]);
    main.replaceChildren(header(),
      el("div", { class: "hbs2-cards" }, ...ms.map((m) => row(m, role.signer))),
      role.maintainer ? adder() : el("p", { class: "hbs2-muted" }, "Only a maintainer's clone can change this."));
  } catch (e) {
    main.append(refusal(e));
  }
}

void load();

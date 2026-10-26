// One thread, as the PEP-22 render contract describes it.
import { call } from "../lib/client.ts";
import { asThread } from "../lib/docs.ts";
import type { ThreadDoc } from "../lib/docs.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { el, shortKey, when } from "../lib/dom.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;

function body(text: string | null, redacted: boolean): HTMLElement {
  if (redacted) return el("p", { class: "muted" }, "(withheld: redacted by a maintainer)");
  if (!text) return el("p", { class: "muted" }, "(no text)");
  // As text, with its line breaks. Markdown is not rendered in this version.
  return el("div", { class: "body" }, text);
}

function render(t: ThreadDoc): void {
  const gh = q.get("gh");
  document.title = `#${t.number ?? "?"} ${t.title ?? ""}`;
  main.replaceChildren(
    el("p", {}, el("a", { href: `repo.html?${new URLSearchParams({ key: q.get("key") ?? "", gh: gh ?? "" })}` }, gh ?? "repository")),
    el("h1", {}, t.redacted ? "(redacted)" : t.title ?? "", " ", el("span", { class: "muted" }, `#${t.number ?? "?"}`)),
    el("p", {},
      el("span", { class: `status ${t.status}` }, t.status), " ",
      t.kind === "pr" ? "pull request" : "issue", " opened by ", shortKey(t.author),
      ", blessed by ", shortKey(t.canon_by), ", ", when(t.created_at),
      t.labels.length ? el("span", { class: "muted" }, "  labels: ", t.labels.join(", ")) : null,
      t.labels_requested.length ? el("span", { class: "muted" }, "  asked for: ", t.labels_requested.join(", ")) : null),
    body(t.body, t.redacted),
    t.pr ? el("section", {},
      el("h2", {}, "Proposal"),
      el("p", {}, "onto ", el("code", {}, t.pr.onto), " base ", el("code", {}, t.pr.base.slice(0, 12)),
         " tip ", el("code", {}, t.pr.tip.slice(0, 12)),
         t.pr.merge_commit ? el("span", {}, " merged as ", el("code", {}, t.pr.merge_commit.slice(0, 12))) : null),
      t.pr.diff && t.pr.diff.availability === "available"
        ? el("pre", { class: "diff" }, t.pr.diff.text, t.pr.diff.truncated ? "\n... (truncated)" : "")
        : el("p", { class: "muted" }, `diff ${t.pr.diff?.availability ?? "unavailable"} here`))
      : "",
    el("h2", {}, `Comments (${t.comments.length})`),
    ...t.comments.map((c) =>
      el("article", { class: "comment" },
        el("p", { class: "muted" }, shortKey(c.author), " ", when(c.ts),
           c.canon_by !== c.author ? el("span", {}, ", blessed by ", shortKey(c.canon_by)) : null),
        body(c.body, c.redacted))),
  );
}

async function main_(): Promise<void> {
  const key = q.get("key") ?? "";
  const number = Number(q.get("number"));
  const kind = q.get("kind") === "pr" ? "pr" : "issue";
  if (!isRepoKey(key) || !Number.isInteger(number) || number < 1) {
    main.replaceChildren(el("p", {}, "This link does not name a thread."));
    return;
  }
  main.replaceChildren(el("p", { class: "muted", id: "progress" }, "loading"));
  try {
    render(asThread(await call(`${kind}_show`, { repo: key, number }, (t) => {
      document.getElementById("progress")!.textContent = t;
    })));
  } catch (e) {
    main.replaceChildren(el("p", {}, e instanceof Error ? e.message : String(e)));
  }
}

void main_();

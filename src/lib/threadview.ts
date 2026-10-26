// One thread laid out the way GitHub lays out an issue or a pull request: the
// title and number, the state, who opened it and when, then the conversation as
// a column of comment boxes with a face beside each, and the labels down the
// side. Used on GitHub itself (inside its page, under its header) and in the
// extension's own thread page, from the same document.
import type { Comment, ThreadDoc } from "./docs.ts";
import { el, markdownEl } from "./dom.ts";
import { identiconEl } from "./identicon.ts";
import { ago } from "./query.ts";

export interface ThreadViewOptions {
  /** The repository key, shown on the side. */
  repo: string;
  /** Where "back" goes, and how it is done (a GitHub list, or the extension's repo page). */
  back: { label: string; go: () => void };
}

const STATE_ICON: Record<string, string[]> = {
  open: ["M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
         "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"],
  closed: ["M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z",
           "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"],
  merged: ["M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"],
};

function icon(paths: string[]): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 16 16");
  s.setAttribute("width", "16");
  s.setAttribute("height", "16");
  s.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
}

const short = (k: string) => k.slice(0, 8);

function who(k: string): HTMLElement {
  return el("strong", { class: "hbs2-who", title: k }, short(k));
}

function timeEl(ms: number): HTMLElement {
  return el("time", { title: new Date(ms).toLocaleString() }, ago(ms));
}

function stateName(t: ThreadDoc): string {
  return t.status === "open" ? "Open" : t.status === "merged" ? "Merged" : t.status === "closed" ? "Closed" : t.status;
}

function body(text: string | null, redacted: boolean): HTMLElement {
  if (redacted) return el("div", { class: "hbs2-c-body hbs2-muted" }, el("em", {}, "Withheld: a maintainer redacted this."));
  if (!text) return el("div", { class: "hbs2-c-body hbs2-muted" }, el("em", {}, "No description provided."));
  return el("div", { class: "hbs2-c-body" }, markdownEl(text));
}

/** One box in the conversation, with its face. */
function commentBox(opts: {
  author: string; canonBy: string; ts: number; text: string | null; redacted: boolean;
  isThreadAuthor: boolean; verb: string;
}): HTMLElement {
  const badges = [
    opts.isThreadAuthor ? el("span", { class: "hbs2-c-badge" }, "Author") : null,
    opts.canonBy === opts.author ? el("span", { class: "hbs2-c-badge" }, "Maintainer") : null,
  ];
  return el("div", { class: "hbs2-c" },
    el("div", { class: "hbs2-c-face" }, identiconEl(opts.author, 40)),
    el("div", { class: "hbs2-c-box" },
      el("div", { class: "hbs2-c-head" },
        who(opts.author), ` ${opts.verb} `, timeEl(opts.ts),
        el("span", { class: "hbs2-c-head-right" },
          ...badges,
          opts.canonBy !== opts.author
            ? el("span", { class: "hbs2-c-blessed", title: opts.canonBy }, `accepted by ${short(opts.canonBy)}`)
            : null)),
      body(opts.text, opts.redacted)));
}

function sideSection(title: string, ...content: (Node | string | null)[]): HTMLElement {
  return el("div", { class: "hbs2-side-sec" }, el("h3", {}, title), ...content);
}

export function threadView(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const back = el("a", { href: "#", class: "hbs2-back" }, o.back.label);
  back.addEventListener("click", (e) => { e.preventDefault(); o.back.go(); });

  const state = t.status === "open" ? "open" : t.status === "merged" ? "merged" : "closed";
  const comments = t.comments.length;

  const header = el("div", { class: "hbs2-t-header" },
    back,
    el("h1", { class: "hbs2-t-title" },
      el("bdi", {}, t.redacted ? "(redacted)" : t.title ?? ""), " ",
      el("span", { class: "hbs2-t-num" }, `#${t.number ?? "?"}`)),
    el("div", { class: "hbs2-t-sub" },
      el("span", { class: `hbs2-state is-${state}` }, icon(STATE_ICON[state]!), stateName(t)),
      el("span", { class: "hbs2-badge", title: "this thread lives on hbs2, not on GitHub" }, "hbs2"),
      el("span", { class: "hbs2-t-meta" },
        who(t.author), ` opened this ${t.kind === "pr" ? "pull request" : "issue"} `, timeEl(t.created_at),
        ` \u00b7 ${comments} ${comments === 1 ? "comment" : "comments"}`)));

  const timeline = el("div", { class: "hbs2-t-timeline" },
    commentBox({ author: t.author, canonBy: t.canon_by, ts: t.created_at, text: t.body, redacted: t.redacted,
                 isThreadAuthor: true, verb: "opened" }),
    t.pr ? proposal(t) : null,
    ...t.comments.map((c: Comment) => commentBox({
      author: c.author, canonBy: c.canon_by, ts: c.ts, text: c.body, redacted: c.redacted,
      isThreadAuthor: c.author === t.author, verb: "commented" })),
    el("div", { class: "hbs2-t-foot hbs2-muted" },
      "This thread lives on hbs2. Replying from this page comes in a later version; for now: ",
      el("code", {}, `hbs2-hub ${t.kind === "pr" ? "pr" : "issue"} comment --number ${t.number ?? "?"} --body -`)));

  const side = el("aside", { class: "hbs2-t-side" },
    sideSection("Labels", t.labels.length
      ? el("div", { class: "hbs2-side-labels" }, ...t.labels.map((l) => el("span", { class: "hbs2-label" }, l)))
      : el("span", { class: "hbs2-muted" }, "None yet")),
    sideSection("Assignees", t.assignees.length
      ? el("div", {}, ...t.assignees.map((a) => el("div", { class: "hbs2-side-person" }, identiconEl(a, 20), " ", short(a))))
      : el("span", { class: "hbs2-muted" }, "No one assigned")),
    t.labels_requested.length
      ? sideSection("Asked for", el("div", { class: "hbs2-side-labels" },
          ...t.labels_requested.map((l) => el("span", { class: "hbs2-label is-asked" }, l))),
          el("p", { class: "hbs2-muted hbs2-small" }, "Labels the author asked for. Only a maintainer applies labels."))
      : null,
    sideSection("Participants", el("div", { class: "hbs2-side-faces" },
      ...[...new Set([t.author, ...t.comments.map((c) => c.author)])].map((k) => {
        const f = identiconEl(k, 26);
        f.setAttribute("aria-label", k);
        return el("span", { title: k }, f);
      }))),
    sideSection("hbs2", el("p", { class: "hbs2-small" }, "Repository ", el("code", { title: o.repo }, short(o.repo))),
      el("p", { class: "hbs2-small" }, "Thread ", el("code", { title: t.thread_id }, short(t.thread_id))),
      el("p", { class: "hbs2-muted hbs2-small" }, "Every item here is signed by its author and accepted into the repository's record by a maintainer.")));

  return el("div", { class: "hbs2-thread", "data-hbs2-hub": "thread" },
    header,
    el("div", { class: "hbs2-t-layout" }, timeline, side));
}

function proposal(t: ThreadDoc): HTMLElement | null {
  const pr = t.pr;
  if (!pr) return null;
  const diff = pr.diff;
  return el("div", { class: "hbs2-c" },
    el("div", { class: "hbs2-c-face" }),
    el("div", { class: "hbs2-c-box" },
      el("div", { class: "hbs2-c-head" }, "Proposed changes onto ", el("code", {}, pr.onto.replace(/^refs\/heads\//, "")),
        el("span", { class: "hbs2-c-head-right" },
          el("code", { title: pr.base }, pr.base.slice(0, 7)), " .. ", el("code", { title: pr.tip }, pr.tip.slice(0, 7)),
          pr.merge_commit ? el("span", { class: "hbs2-c-badge" }, `merged as ${pr.merge_commit.slice(0, 7)}`) : null)),
      diff && diff.availability === "available"
        ? el("pre", { class: "hbs2-diff" }, ...diffLines(diff.text), diff.truncated ? "\n... (truncated)" : "")
        : el("div", { class: "hbs2-c-body hbs2-muted" },
            `The diff is ${diff?.availability ?? "unavailable"} here. Check it out with `,
            el("code", {}, `hbs2-hub pr checkout --number ${t.number ?? "?"}`), ".")));
}

function diffLines(text: string): HTMLElement[] {
  return text.split("\n").map((l) => {
    const cls = l.startsWith("+") && !l.startsWith("+++") ? "add"
      : l.startsWith("-") && !l.startsWith("---") ? "del"
      : l.startsWith("@@") ? "hunk" : l.startsWith("diff ") || l.startsWith("index ") ? "meta" : "";
    return el("span", { class: `hbs2-dl ${cls}` }, l + "\n");
  });
}

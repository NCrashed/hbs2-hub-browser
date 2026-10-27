// One line of an issue or pull request list, as GitHub draws its own: the
// state icon, the title and labels, who opened it and when, the comments.
// The same line on a GitHub page (opening the thread in place) and on the
// web build's repository page (a link to the thread page).
import type { IndexRow } from "./docs.ts";
import { el } from "./dom.ts";
import { ago } from "./query.ts";
import { iconEl, stateLook } from "./threadview.ts";

export function rowEl(t: IndexRow, kind: "issue" | "pr", href: string, opts: {
  /** Open it here instead of following the link; a middle or ctrl click still follows it. */
  open?: () => void;
  /** The "hbs2" mark, which says where a line comes from among GitHub's own. */
  badge?: boolean;
} = {}): HTMLElement {
  const title = el("a", { href, class: "hbs2-title" }, t.redacted ? "(redacted)" : t.title ?? "");
  const open = opts.open;
  if (open) title.addEventListener("click", (e) => {
    if (e instanceof MouseEvent && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey)) return;
    e.preventDefault();
    open();
  });
  return el("li", { class: "hbs2-row" },
    stateIcon(kind, t.status),
    el("div", { class: "hbs2-main" },
      el("div", { class: "hbs2-head" },
        title,
        ...t.labels.map((l) => el("span", { class: "hbs2-label" }, l)),
        opts.badge ? el("span", { class: "hbs2-badge", title: "this thread lives on hbs2, not on GitHub" }, "hbs2") : null),
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

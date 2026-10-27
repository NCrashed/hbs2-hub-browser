// One thread laid out the way GitHub lays out an issue or a pull request: the
// title and number, the state, who opened it and when, then the conversation as
// a column of comment boxes with a face beside each, and the labels down the
// side. A pull request also gets GitHub's two tabs, Conversation and Files
// changed, the second drawn from the precomputed diff with line numbers. Used
// on GitHub itself (inside its page, under its header) and in the extension's
// own thread page, from the same document.
import type { Comment, ThreadDoc } from "./docs.ts";
import { el, markdownEl } from "./dom.ts";
import { identiconEl } from "./identicon.ts";
import { ago } from "./query.ts";
import { editor } from "./editor.ts";
import { fileName, parseDiff } from "./diff.ts";
import type { DiffFile } from "./diff.ts";

export interface ThreadViewOptions {
  /** The repository key, shown on the side. */
  repo: string;
  /** Where "back" goes, and how it is done (a GitHub list, or the extension's repo page). */
  back: { label: string; go: () => void };
  /**
   * What the person may write here, when the page can open the extension's
   * forms: a comment; and once `maintains` says this clone signs as a
   * maintainer, a merge, closing or reopening, and the labels.
   */
  actions?: {
    comment?: (draft: string) => void;
    land?: () => void;
    close?: (note: string) => void;
    reopen?: (note: string) => void;
    labels?: (labels: string[]) => void;
    /** A key, or "" to unassign. */
    assign?: (key: string) => void;
    redact?: (event: string) => void;
    /** Record a merge made with git or on GitHub. */
    record?: () => void;
    /** Labels used elsewhere in the repository, offered when editing. */
    knownLabels?: string[];
    maintains?: Promise<boolean>;
  };
}

// Octicons (MIT, GitHub), drawn with the DOM API rather than parsed markup.
export const ICONS: Record<string, string[]> = {
  "issue-open": ["M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
                 "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"],
  "issue-closed": ["M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z",
                   "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"],
  "pr-open": ["M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"],
  "pr-merged": ["M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"],
  "pr-closed": ["M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"],
  comment: ["M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"],
  "chevron-down": ["M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"],
  file: ["M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"],
};

export function iconEl(name: string, size = 16): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 16 16");
  s.setAttribute("width", String(size));
  s.setAttribute("height", String(size));
  s.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name] ?? []) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
}

/** The icon and the colour class for a thread's state, as GitHub picks them. */
export function stateLook(kind: "issue" | "pr", status: string): { icon: string; cls: string; name: string } {
  if (kind === "pr") {
    if (status === "open") return { icon: "pr-open", cls: "is-open", name: "Open" };
    if (status === "merged") return { icon: "pr-merged", cls: "is-merged", name: "Merged" };
    return { icon: "pr-closed", cls: "is-closed-pr", name: "Closed" };
  }
  if (status === "open") return { icon: "issue-open", cls: "is-open", name: "Open" };
  return { icon: "issue-closed", cls: "is-closed", name: status === "closed" ? "Closed" : status };
}

const short = (k: string) => k.slice(0, 8);

function who(k: string): HTMLElement {
  return el("strong", { class: "hbs2-who", title: k }, short(k));
}

function timeEl(ms: number): HTMLElement {
  return el("time", { title: new Date(ms).toLocaleString() }, ago(ms));
}

function branch(name: string): HTMLElement {
  return el("code", { class: "hbs2-branch" }, name.replace(/^refs\/heads\//, ""));
}

function body(text: string | null, redacted: boolean, empty = "No description provided."): HTMLElement {
  if (redacted) return el("div", { class: "hbs2-c-body hbs2-muted" }, el("em", {}, "Withheld: a maintainer redacted this."));
  if (!text) return el("div", { class: "hbs2-c-body hbs2-muted" }, el("em", {}, empty));
  return el("div", { class: "hbs2-c-body" }, markdownEl(text));
}

/** One box in the conversation, with its face. */
function commentBox(opts: {
  author: string; canonBy: string; ts: number; text: string | null; redacted: boolean;
  isThreadAuthor: boolean; verb: string;
  /** For a maintainer: withhold this one's text. */
  redact?: { go: () => void; can: Promise<boolean> | undefined };
}): HTMLElement {
  let redact: HTMLElement | null = null;
  if (opts.redact && !opts.redacted) {
    const r = opts.redact;
    redact = el("button", { type: "button", class: "hbs2-gear", title: "Withhold this text from every reader" }, "Redact");
    redact.hidden = true;
    redact.addEventListener("click", () => r.go());
    const b = redact;
    void (r.can ?? Promise.resolve(false)).then((yes) => { b.hidden = !yes; }, () => {});
  }
  return el("div", { class: "hbs2-c" },
    el("div", { class: "hbs2-c-face" }, identiconEl(opts.author, 40)),
    el("div", { class: "hbs2-c-box" },
      el("div", { class: "hbs2-c-head" },
        who(opts.author), ` ${opts.verb} `, timeEl(opts.ts),
        el("span", { class: "hbs2-c-head-right" },
          opts.isThreadAuthor ? el("span", { class: "hbs2-c-badge" }, "Author") : null,
          opts.canonBy === opts.author ? el("span", { class: "hbs2-c-badge" }, "Maintainer") : null,
          opts.canonBy !== opts.author
            ? el("span", { class: "hbs2-c-blessed", title: opts.canonBy }, `accepted by ${short(opts.canonBy)}`)
            : null,
          redact)),
      body(opts.text, opts.redacted)));
}

/** A one-line event in the conversation (a merge), drawn on the timeline rather than in a box. */
function eventRow(iconName: string, cls: string, ...content: (Node | string | null)[]): HTMLElement {
  return el("div", { class: "hbs2-ev" },
    el("span", { class: `hbs2-ev-badge ${cls}` }, iconEl(iconName)),
    el("div", { class: "hbs2-ev-text" }, ...content));
}

function sideSection(title: string, ...content: (Node | string | null)[]): HTMLElement {
  return el("div", { class: "hbs2-side-sec" }, el("h3", {}, title), ...content);
}

export function threadView(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const back = el("a", { href: "#", class: "hbs2-back" }, o.back.label);
  back.addEventListener("click", (e) => { e.preventDefault(); o.back.go(); });

  const look = stateLook(t.kind, t.status);
  const comments = t.comments.length;
  const pr = t.kind === "pr" ? t.pr : undefined;

  const meta = pr
    ? el("span", { class: "hbs2-t-meta" },
        who(t.author), t.status === "open" ? " wants to merge into " : " proposed merging into ", branch(pr.onto),
        pr.source_ref ? el("span", {}, " from ", branch(pr.source_ref)) : null,
        pr.merge_commit
          ? el("span", {}, ", merged as ", el("code", { title: pr.merge_commit }, pr.merge_commit.slice(0, 7)))
          : el("span", {}, " \u00b7 opened ", timeEl(t.created_at)))
    : el("span", { class: "hbs2-t-meta" },
        who(t.author), " opened this issue ", timeEl(t.created_at),
        ` \u00b7 ${comments} ${comments === 1 ? "comment" : "comments"}`);

  const header = el("div", { class: "hbs2-t-header" },
    back,
    el("h1", { class: "hbs2-t-title" },
      el("bdi", {}, t.redacted ? "(redacted)" : t.title ?? ""), " ",
      el("span", { class: "hbs2-t-num" }, `#${t.number ?? "?"}`)),
    el("div", { class: "hbs2-t-sub" },
      el("span", { class: `hbs2-state ${look.cls}` }, iconEl(look.icon), look.name),
      el("span", { class: "hbs2-badge", title: "this thread lives on hbs2, not on GitHub" }, "hbs2"),
      meta));

  const conversation = el("div", { class: "hbs2-t-layout" }, timeline(t, o), side(t, o));
  const root = el("div", { class: "hbs2-thread", "data-hbs2-hub": "thread" }, header);

  if (!pr) {
    root.append(conversation);
    return root;
  }

  // A pull request: GitHub's two tabs over the same header.
  const files = pr.diff && pr.diff.availability === "available" ? parseDiff(pr.diff.text) : [];
  const adds = files.reduce((n, f) => n + f.adds, 0);
  const dels = files.reduce((n, f) => n + f.dels, 0);
  const filesView = el("div", { class: "hbs2-files" }, ...filesBody(t, files));
  filesView.hidden = true;

  const tabConv = el("button", { type: "button", class: "hbs2-tab is-selected" },
    iconEl("comment"), "Conversation", el("span", { class: "hbs2-tab-count" }, String(comments)));
  const tabFiles = el("button", { type: "button", class: "hbs2-tab" },
    iconEl("file"), "Files changed", el("span", { class: "hbs2-tab-count" }, String(files.length)));
  const select = (showFiles: boolean) => {
    conversation.hidden = showFiles;
    filesView.hidden = !showFiles;
    tabConv.classList.toggle("is-selected", !showFiles);
    tabFiles.classList.toggle("is-selected", showFiles);
  };
  tabConv.addEventListener("click", () => select(false));
  tabFiles.addEventListener("click", () => select(true));

  root.append(
    el("div", { class: "hbs2-tabs" }, tabConv, tabFiles,
      el("span", { class: "hbs2-diffstat" },
        el("span", { class: "hbs2-add" }, `+${adds}`), " ", el("span", { class: "hbs2-del" }, `-${dels}`))),
    conversation,
    filesView);
  return root;
}

function timeline(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const pr = t.kind === "pr" ? t.pr : undefined;
  const foot = t.kind === "pr" ? "pr" : "issue";
  const a = o.actions;
  return el("div", { class: "hbs2-t-timeline" },
    // The opening's event id is the thread id (PEP-19).
    commentBox({ author: t.author, canonBy: t.canon_by, ts: t.created_at, text: t.body, redacted: t.redacted,
                 isThreadAuthor: true, verb: "opened",
                 redact: a?.redact ? { go: () => a.redact?.(t.thread_id), can: a.maintains } : undefined }),
    ...t.comments.map((c: Comment) => commentBox({
      author: c.author, canonBy: c.canon_by, ts: c.ts, text: c.body, redacted: c.redacted,
      isThreadAuthor: c.author === t.author, verb: "commented",
      redact: a?.redact ? { go: () => a.redact?.(c.event_id), can: a.maintains } : undefined })),
    pr && pr.merge_commit
      ? eventRow("pr-merged", "is-merged", "Merged commit ",
          el("code", { title: pr.merge_commit }, pr.merge_commit.slice(0, 7)), " into ", branch(pr.merged_into ?? pr.onto))
      : null,
    pr && t.status === "closed" ? eventRow("pr-closed", "is-closed-pr", "Closed without merging") : null,
    pr && t.status === "open" && a?.land ? mergeBox(pr.onto, a.land, a.maintains, a.record) : null,
    a?.comment
      ? composer(t, a.comment, a)
      : el("div", { class: "hbs2-t-foot hbs2-muted" },
          "This thread lives on hbs2. To reply: ",
          el("code", {}, `hbs2-hub ${foot} comment --number ${t.number ?? "?"} --body -`)));
}

// GitHub's merge box, for a maintainer: hidden until the clone says it signs
// as one, since a button that can only be refused is worse than none.
function mergeBox(onto: string, land: () => void, can: Promise<boolean> | undefined, record?: () => void): HTMLElement {
  const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Merge pull request");
  go.addEventListener("click", () => land());
  // A merge made with git or on GitHub is not this button's; it is recorded.
  const elsewhere = record ? el("button", { type: "button", class: "hbs2-gear hbs2-elsewhere" }, "Merged it elsewhere? Record the merge") : null;
  elsewhere?.addEventListener("click", () => record?.());
  const box = el("div", { class: "hbs2-merge" },
    el("span", { class: "hbs2-ev-badge is-open-pr" }, iconEl("pr-open")),
    el("div", { class: "hbs2-merge-box" },
      el("div", { class: "hbs2-merge-text" },
        el("strong", {}, "Merge it on hbs2"),
        el("span", { class: "hbs2-muted" },
          "A merge commit into ", branch(onto), " in your working clone, pushed, recorded in canon and published. "
          + "You review exactly what it does first."),
        elsewhere),
      go));
  box.hidden = true;
  void (can ?? Promise.resolve(true)).then((yes) => { box.hidden = !yes; }, () => {});
  return box;
}

// GitHub's comment box at the end of the conversation, with its Write and
// Preview tabs. "Comment" carries the text to the extension's window, which
// opens on the review: it shows the comment as it will read and is where it
// is signed. This box sits on a page others can write to, so it never signs.
function composer(t: ThreadDoc, comment: (draft: string) => void, a: NonNullable<ThreadViewOptions["actions"]>): HTMLElement {
  const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Comment");
  let ed: ReturnType<typeof editor> | null = null;
  const send = () => {
    if (!ed) return;
    if (!ed.value().trim()) { ed.focus(); return; }
    comment(ed.value());
  };
  // GitHub's Close button beside Comment, for a maintainer: with text in the
  // box it closes with that as the note. A merged pull request has neither.
  const noun = t.kind === "pr" ? "pull request" : "issue";
  const toggle = t.status === "open" && a.close ? { label: `Close ${noun}`, act: a.close, icon: t.kind === "pr" ? "pr-closed" : "issue-closed" }
    : t.status === "closed" && a.reopen ? { label: `Reopen ${noun}`, act: a.reopen, icon: t.kind === "pr" ? "pr-open" : "issue-open" }
    : null;
  const side = toggle ? el("button", { type: "button", class: "hbs2-btn hbs2-toggle" }, iconEl(toggle.icon), toggle.label) : null;
  if (side && toggle) {
    side.hidden = true;
    void (a.maintains ?? Promise.resolve(false)).then((yes) => { side.hidden = !yes; }, () => {});
    side.addEventListener("click", () => toggle.act(ed?.value() ?? ""));
  }
  ed = editor({ placeholder: "Add your comment here...", rows: 5,
                action: el("span", { class: "hbs2-efoot-actions" }, side, go), submit: send });
  go.addEventListener("click", send);
  return el("div", { class: "hbs2-c hbs2-composer" },
    el("div", { class: "hbs2-c-face" }),
    el("div", { class: "hbs2-composer-box" },
      el("div", { class: "hbs2-composer-title" }, el("strong", {}, "Add a comment"),
        el("span", { class: "hbs2-muted hbs2-small" }, "signed by you, on hbs2, after you review it")),
      ed.node));
}

// The labels in the side column, and for a maintainer GitHub's gear: pick
// from the repository's labels or type new ones, then Apply. Apply only
// carries the set to the extension's window, where it is reviewed and signed.
function labelSection(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const a = o.actions;
  const shown = el("div", { class: "hbs2-side-labels" },
    ...(t.labels.length ? t.labels.map((l) => el("span", { class: "hbs2-label" }, l))
                        : [el("span", { class: "hbs2-muted" }, "None yet")]));
  if (!a?.labels) return sideSection("Labels", shown);
  const setLabels = a.labels;

  const chosen = new Set(t.labels);
  const known = [...new Set([...(a.knownLabels ?? []), ...t.labels, ...t.labels_requested])].sort();
  const chips = el("div", { class: "hbs2-side-labels hbs2-pick" });
  const drawChips = () => chips.replaceChildren(...known.map((l) => {
    const c = el("button", { type: "button", class: `hbs2-label hbs2-chip${chosen.has(l) ? " is-on" : ""}`, "aria-pressed": String(chosen.has(l)) }, l);
    c.addEventListener("click", () => { chosen.has(l) ? chosen.delete(l) : chosen.add(l); drawChips(); });
    return c;
  }));
  drawChips();
  const more = el("input", { class: "hbs2-input hbs2-small-in", placeholder: "New labels, comma separated" });
  const apply = el("button", { type: "button", class: "hbs2-btn is-primary hbs2-small-btn" }, "Apply");
  const cancel = el("button", { type: "button", class: "hbs2-btn hbs2-small-btn" }, "Cancel");
  const panel = el("div", { class: "hbs2-label-edit" }, chips, more, el("div", { class: "hbs2-edit-actions" }, cancel, apply));
  panel.hidden = true;
  const gear = el("button", { type: "button", class: "hbs2-gear", title: "Edit labels" }, "Edit");
  gear.hidden = true;
  void (a.maintains ?? Promise.resolve(false)).then((yes) => { gear.hidden = !yes; }, () => {});
  gear.addEventListener("click", () => { panel.hidden = !panel.hidden; shown.hidden = !panel.hidden; });
  cancel.addEventListener("click", () => { panel.hidden = true; shown.hidden = false; });
  apply.addEventListener("click", () => {
    const extra = more.value.split(",").map((l) => l.trim()).filter((l) => l.length > 0);
    setLabels([...new Set([...chosen, ...extra])]);
  });
  return el("div", { class: "hbs2-side-sec" },
    el("h3", { class: "hbs2-side-head" }, "Labels", gear), shown, panel);
}

// Who is looking, and for a maintainer: pick one of the participants or paste
// a key, or unassign. Apply carries it to the window's review.
function assigneeSection(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const a = o.actions;
  const shown = t.assignees.length
    ? el("div", {}, ...t.assignees.map((k) => el("div", { class: "hbs2-side-person" }, identiconEl(k, 20), " ", short(k))))
    : el("span", { class: "hbs2-muted" }, "No one assigned");
  if (!a?.assign) return sideSection("Assignees", shown);
  const assign = a.assign;
  const input = el("input", { class: "hbs2-input hbs2-small-in", placeholder: "A key (base58)", value: t.assignees[0] ?? "" });
  const people = [...new Set([t.author, ...t.comments.map((c) => c.author)])];
  const picks = el("div", { class: "hbs2-side-faces" }, ...people.map((k) => {
    const b = el("button", { type: "button", class: "hbs2-pick-face", title: k }, identiconEl(k, 24));
    b.addEventListener("click", () => { input.value = k; });
    return b;
  }));
  const apply = el("button", { type: "button", class: "hbs2-btn is-primary hbs2-small-btn" }, "Apply");
  const none = el("button", { type: "button", class: "hbs2-btn hbs2-small-btn" }, "Unassign");
  const cancel = el("button", { type: "button", class: "hbs2-btn hbs2-small-btn" }, "Cancel");
  const panel = el("div", { class: "hbs2-label-edit" }, picks, input, el("div", { class: "hbs2-edit-actions" }, cancel, none, apply));
  panel.hidden = true;
  const gear = el("button", { type: "button", class: "hbs2-gear", title: "Edit the assignee" }, "Edit");
  gear.hidden = true;
  void (a.maintains ?? Promise.resolve(false)).then((yes) => { gear.hidden = !yes; }, () => {});
  gear.addEventListener("click", () => { panel.hidden = !panel.hidden; shown.hidden = !panel.hidden; });
  cancel.addEventListener("click", () => { panel.hidden = true; shown.hidden = false; });
  apply.addEventListener("click", () => { if (input.value.trim()) assign(input.value.trim()); else input.focus(); });
  none.addEventListener("click", () => assign(""));
  return el("div", { class: "hbs2-side-sec" }, el("h3", { class: "hbs2-side-head" }, "Assignees", gear), shown, panel);
}

// What the author asked for, and for a maintainer the one click that grants it.
// Only what is still asked for: a label already applied is no longer a request.
function askedSection(t: ThreadDoc, o: ThreadViewOptions): HTMLElement | null {
  const asked = t.labels_requested.filter((l) => !t.labels.includes(l));
  if (!asked.length) return null;
  const a = o.actions;
  const grant = a?.labels ? el("button", { type: "button", class: "hbs2-btn hbs2-small-btn" }, "Apply these") : null;
  if (grant && a?.labels) {
    const setLabels = a.labels;
    grant.hidden = true;
    void (a.maintains ?? Promise.resolve(false)).then((yes) => { grant.hidden = !yes; }, () => {});
    grant.addEventListener("click", () => setLabels([...new Set([...t.labels, ...asked])]));
  }
  return sideSection("Asked for", el("div", { class: "hbs2-side-labels" },
      ...asked.map((l) => el("span", { class: "hbs2-label is-asked" }, l))),
    el("p", { class: "hbs2-muted hbs2-small" }, "Labels the author asked for. Only a maintainer applies labels."),
    grant);
}

function side(t: ThreadDoc, o: ThreadViewOptions): HTMLElement {
  const pr = t.kind === "pr" ? t.pr : undefined;
  return el("aside", { class: "hbs2-t-side" },
    pr ? sideSection("Proposal",
      el("p", { class: "hbs2-small" }, "onto ", branch(pr.onto)),
      el("p", { class: "hbs2-small" }, "base ", el("code", { title: pr.base }, pr.base.slice(0, 7))),
      el("p", { class: "hbs2-small" }, "tip ", el("code", { title: pr.tip }, pr.tip.slice(0, 7))),
      el("p", { class: "hbs2-muted hbs2-small" }, "Review it locally: ",
        el("code", {}, `hbs2-hub pr checkout --number ${t.number ?? "?"}`))) : null,
    labelSection(t, o),
    assigneeSection(t, o),
    askedSection(t, o),
    sideSection("Participants", el("div", { class: "hbs2-side-faces" },
      ...[...new Set([t.author, ...t.comments.map((c) => c.author)])].map((k) => {
        const f = identiconEl(k, 26);
        f.setAttribute("aria-label", k);
        return el("span", { title: k }, f);
      }))),
    sideSection("hbs2", el("p", { class: "hbs2-small" }, "Repository ", el("code", { title: o.repo }, short(o.repo))),
      el("p", { class: "hbs2-small" }, "Thread ", el("code", { title: t.thread_id }, short(t.thread_id))),
      el("p", { class: "hbs2-muted hbs2-small" }, "Every item here is signed by its author and accepted into the repository's record by a maintainer.")));
}

function filesBody(t: ThreadDoc, files: DiffFile[]): HTMLElement[] {
  const diff = t.pr?.diff;
  if (!diff || diff.availability !== "available") {
    return [el("div", { class: "hbs2-c-box hbs2-c-body hbs2-muted" },
      `The diff is ${diff?.availability ?? "unavailable"} here. Check it out with `,
      el("code", {}, `hbs2-hub pr checkout --number ${t.number ?? "?"}`), ".")];
  }
  const out = files.map(fileBox);
  if (diff.truncated) out.push(el("div", { class: "hbs2-muted hbs2-small" }, "The diff is truncated here; check the pull request out for the rest."));
  if (files.length === 0) out.push(el("div", { class: "hbs2-muted" }, "No changes."));
  return out;
}

function fileBox(f: DiffFile): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const h of f.hunks) {
    rows.push(el("tr", { class: "hbs2-dh" }, el("td", { class: "hbs2-ln" }), el("td", { class: "hbs2-ln" }), el("td", {}, h.header)));
    for (const l of h.lines) {
      const sign = l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ";
      rows.push(el("tr", { class: `hbs2-dr is-${l.kind}` },
        el("td", { class: "hbs2-ln" }, l.old === null ? "" : String(l.old)),
        el("td", { class: "hbs2-ln" }, l.new === null ? "" : String(l.new)),
        el("td", { class: "hbs2-code" }, l.kind === "note" ? l.text : sign + l.text)));
    }
  }
  const content = f.binary ? el("div", { class: "hbs2-c-body hbs2-muted" }, "Binary file not shown.")
                           : el("table", { class: "hbs2-dtable" }, el("tbody", {}, ...rows));
  // The chevron folds the file away, as on GitHub, for a long change
  // where one file is already read.
  const fold = el("button", { type: "button", class: "hbs2-fold", "aria-expanded": "true", title: "Collapse file" },
    iconEl("chevron-down"));
  fold.addEventListener("click", () => {
    content.hidden = !content.hidden;
    fold.setAttribute("aria-expanded", String(!content.hidden));
    fold.title = content.hidden ? "Expand file" : "Collapse file";
    fold.classList.toggle("is-folded", content.hidden);
  });
  return el("div", { class: "hbs2-file" },
    el("div", { class: "hbs2-file-head" },
      fold,
      el("span", { class: "hbs2-add" }, `+${f.adds}`), " ", el("span", { class: "hbs2-del" }, `-${f.dels}`), " ",
      el("strong", {}, fileName(f)),
      f.change !== "modified" ? el("span", { class: "hbs2-c-badge" }, f.change) : null),
    content);
}

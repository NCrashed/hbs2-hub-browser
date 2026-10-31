// A maintainer's inbox: the letters waiting in the repository's mailbox, and
// accepting, rejecting or honouring each one (PEP-24 phase 3).
//
// An extension page, so it may write; every write is rehearsed first and the
// dry run is shown under the letter, with the button that signs. A letter is
// a stranger's bytes: its title and body are drawn as text and through the
// extension's own Markdown reader, as everywhere else.
import { call, changed } from "../lib/client.ts";
import { CANON_WARN, refusal, rehearse } from "../lib/rehearse.ts";
import { roleOf } from "../lib/compose.ts";
import { asIndex, asLetter, asQueue } from "../lib/docs.ts";
import type { LetterDoc, QueueLetter } from "../lib/docs.ts";
import { el, markdownEl, shortKey } from "../lib/dom.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { siteBar } from "../lib/bar.ts";
import { ago } from "../lib/query.ts";
import { identiconEl } from "../lib/identicon.ts";
import { acceptedPullNumber, acceptedPullUrl } from "../lib/acceptance.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
const repo = q.get("key") ?? "";
const gh = q.get("gh") ?? "";
siteBar(isRepoKey(repo) ? repo : null);
const tabText = q.get("tab");
const tab = tabText && /^\d{1,12}$/.test(tabText) ? Number(tabText) : null;

// What a letter asks for, in words, and which verb answers it.
const OPS: Record<string, { label: string; verb: "accept" | "honour" }> = {
  open: { label: "New thread", verb: "accept" },
  comment: { label: "Comment", verb: "accept" },
  revise: { label: "Revised pull request", verb: "accept" },
  close: { label: "Asks to close", verb: "honour" },
  reopen: { label: "Asks to reopen", verb: "honour" },
  set: { label: "Asks for a label", verb: "honour" },
};

function header(n: number | null): HTMLElement {
  const refresh = el("button", { type: "button", class: "hbs2-btn" }, "Refresh");
  refresh.addEventListener("click", () => void load());
  const people = el("a", { href: `maintainers.html?${new URLSearchParams({ key: repo, gh, ...(tab !== null ? { tab: String(tab) } : {}) })}`, class: "hbs2-btn" }, "Maintainers");
  return el("div", { class: "hbs2-c-header hbs2-inbox-head" },
    el("div", {},
      el("h1", {}, "Inbox"),
      el("p", { class: "hbs2-muted" }, gh ? `${gh} \u00b7 ` : "", "hbs23://", el("code", { title: repo }, shortKey(repo)),
        n !== null ? ` \u00b7 ${n} ${n === 1 ? "letter" : "letters"} waiting` : "")),
    el("div", { class: "hbs2-edit-actions" }, people, refresh));
}

async function acceptedPullNotice(tool: string, d: LetterDoc): Promise<HTMLElement | null> {
  if (tool !== "inbox_accept" || d.pr === null) return null;
  let number: number | null = null;
  try {
    number = acceptedPullNumber(d, asIndex(await call("pr_list", { repo })).threads);
  } catch { /* the accept succeeded; a failed refresh must not say otherwise */ }
  return el("div", {},
    el("p", {}, number === null
      ? "The pull request is now in canon. It is not merged yet."
      : `Pull request #${number} is now in canon. It is not merged yet.`),
    number === null
      ? el("a", { class: "hbs2-btn", href: `repo.html?${new URLSearchParams({ key: repo, ...(gh ? { gh } : {}), tab: "pulls" })}` }, "Open pull requests")
      : el("a", { class: "hbs2-btn is-primary", href: acceptedPullUrl(repo, gh, number) }, "Review and merge"));
}

interface AnswerRun {
  letter: LetterDoc;
  card: HTMLElement;
  panel: HTMLElement;
  result: HTMLElement;
  yes: HTMLButtonElement;
  no: HTMLButtonElement;
}

async function runAnswer(
  view: AnswerRun,
  tool: string,
  args: { [k: string]: string | boolean },
  publish: boolean,
  doneText: string,
): Promise<void> {
  view.yes.disabled = view.no.disabled = true;
  const rejecting = tool === "inbox_reject";
  const out = await rehearse(view.result, {
    tool, args, publish: publish ? repo : null,
    sign: rejecting ? "Reject it" : publish ? "Sign and publish" : "Sign",
    warn: rejecting ? "The letter is dropped from the mailbox for every peer; it cannot be brought back." : CANON_WARN,
  });
  if (out === null) { view.yes.disabled = view.no.disabled = false; return; }
  await changed(tab, repo).catch(() => {});
  view.card.classList.add("is-done");
  const accepted = await acceptedPullNotice(tool, view.letter);
  view.panel.replaceChildren(el("div", { class: "hbs2-flash is-ok" },
    el("strong", {}, doneText), accepted, el("pre", { class: "hbs2-out" }, out)));
}

// The verbs a letter can be answered with, each rehearsed before it signs.
function answer(l: QueueLetter, d: LetterDoc, card: HTMLElement, panel: HTMLElement): HTMLElement {
  const op = OPS[l.op ?? ""] ?? { label: l.op ?? "letter", verb: "accept" as const };
  const yes = el("button", { type: "button", class: "hbs2-btn is-primary" }, op.verb === "honour" ? "Honour" : "Accept");
  const no = el("button", { type: "button", class: "hbs2-btn" }, "Reject");
  const silent = el("input", { type: "checkbox" });
  const result = el("div", { class: "hbs2-confirm" });
  const view = { letter: d, card, panel, result, yes, no };

  yes.addEventListener("click", () => void runAnswer(view, op.verb === "honour" ? "inbox_honour" : "inbox_accept",
    { repo, message: l.message }, true, op.verb === "honour" ? "Honoured and published." : "Accepted and published."));
  no.addEventListener("click", () => void runAnswer(view, "inbox_reject",
    { repo, message: l.message, ...(silent.checked ? { silent: true } : {}) }, false, "Rejected."));

  return el("div", { class: "hbs2-answer" },
    el("div", { class: "hbs2-actions hbs2-answer-row" },
      el("label", { class: "hbs2-check hbs2-small" }, silent, " Reject without telling the sender"),
      no, yes),
    result);
}

function letterBody(d: LetterDoc): HTMLElement {
  const verdict = d.triage?.verdict ?? "unknown";
  return el("div", { class: "hbs2-letter" },
    d.unreadable ? el("div", { class: "hbs2-flash is-error" }, `Unreadable: ${d.unreadable}`) : null,
    el("div", { class: "hbs2-letter-meta hbs2-muted hbs2-small" },
      `verdict: ${verdict}`, d.triage?.reason?.code ? ` (${d.triage.reason.code})` : "",
      d.subject?.number ? ` \u00b7 about #${d.subject.number}` : "",
      d.subject?.title ? el("span", {}, " ", el("bdi", {}, d.subject.title)) : null),
    d.body ? el("div", { class: "hbs2-md hbs2-letter-body" }, markdownEl(d.body))
           : el("p", { class: "hbs2-muted" }, el("em", {}, "No body.")),
    d.labels_requested.length
      ? el("div", { class: "hbs2-side-labels" }, el("span", { class: "hbs2-muted hbs2-small" }, "Asks for labels: "),
          ...d.labels_requested.map((x) => el("span", { class: "hbs2-label is-asked" }, x)))
      : null,
    d.pr ? el("p", { class: "hbs2-small" }, "Proposes ", el("code", {}, d.pr.source_ref ?? "?"), " onto ",
             el("code", {}, (d.pr.onto ?? "?").replace(/^refs\/heads\//, "")),
             d.pr.tip ? el("span", {}, ", tip ", el("code", { title: d.pr.tip }, d.pr.tip.slice(0, 7))) : null)
         : null);
}

// The threads canon holds, by id: a comment or a request names its thread by
// id alone, and a person knows it by its number and title.
type Threads = Map<string, { number: number | null; title: string | null; kind: "issue" | "pr" }>;

async function threadsOf(): Promise<Threads> {
  const m: Threads = new Map();
  for (const kind of ["issue", "pr"] as const) {
    try {
      for (const t of asIndex(await call(`${kind}_list`, { repo })).threads) m.set(t.thread_id, { number: t.number, title: t.title, kind });
    } catch { /* a list that will not read leaves those threads unnamed */ }
  }
  return m;
}

function card(l: QueueLetter, threads: Threads): HTMLElement {
  const about = l.thread ? threads.get(l.thread) : undefined;
  const op = OPS[l.op ?? ""];
  const panel = el("div", { class: "hbs2-card-panel" });
  panel.hidden = true;
  const head = el("button", { type: "button", class: "hbs2-card-head" },
    l.author ? identiconEl(l.author, 32) : el("span", {}),
    el("span", { class: "hbs2-card-title" },
      el("span", { class: "hbs2-op" }, op?.label ?? l.op ?? "letter"),
      el("strong", {},
        about ? el("span", { class: "hbs2-muted" }, `on #${about.number ?? "?"} `) : null,
        el("bdi", {}, l.title ?? about?.title ?? (l.thread ? "a thread this clone does not know" : "(no title)"))),
      el("span", { class: "hbs2-muted hbs2-small" },
        "from ", l.author ? shortKey(l.author) : "?", l.declared_at ? ` \u00b7 ${ago(l.declared_at)}` : "",
        l.disposition !== "folds" ? ` \u00b7 ${l.disposition}` : "")),
    el("span", { class: "hbs2-muted hbs2-small" }, "Open"));
  const box = el("div", { class: "hbs2-card" }, head, panel);
  let loaded = false;
  head.addEventListener("click", async () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden || loaded) return;
    loaded = true;
    panel.replaceChildren(el("p", { class: "hbs2-muted" }, "Opening the letter"));
    try {
      const d = asLetter(await call("inbox_show", { repo, message: l.message }));
      panel.replaceChildren(letterBody(d), d.folded
        ? el("p", { class: "hbs2-muted" }, "Already in canon; nothing to do but reject the copy.")
        : el("div", {}), answer(l, d, box, panel));
    } catch (e) {
      loaded = false;
      panel.replaceChildren(refusal(e));
    }
  });
  return box;
}

async function load(): Promise<void> {
  if (!isRepoKey(repo)) {
    main.replaceChildren(el("p", {}, "This link does not name a repository."));
    return;
  }
  main.replaceChildren(header(null), el("p", { class: "hbs2-muted" }, "Reading the mailbox; the peer's copy can take a few seconds to settle"));
  try {
    const role = roleOf(await call("status", { repo, local: true }));
    if (!role.maintainer) {
      main.replaceChildren(header(null), el("div", { class: "hbs2-flash is-error" },
        "Triage needs a maintainer key in this clone, and the key it signs with is not one."));
      return;
    }
    const [doc, threads] = await Promise.all([call("inbox_list", { repo }).then(asQueue), threadsOf()]);
    main.replaceChildren(...[header(doc.letters.length),
      doc.letters.length
        ? el("div", { class: "hbs2-cards" }, ...doc.letters.map((l) => card(l, threads)))
        : el("div", { class: "hbs2-blank" }, el("strong", {}, "Nothing waiting."),
            el("p", { class: "hbs2-muted" }, "Letters from contributors arrive here: issues, comments and pull requests.")),
      doc.omitted > 0 ? el("p", { class: "hbs2-muted" }, `${doc.omitted} more not shown; deal with these and refresh.`) : null,
      doc.denied > 0 ? el("p", { class: "hbs2-muted" }, `${doc.denied} from banned authors, not shown.`) : null]
      .filter((x): x is HTMLElement => x !== null));
  } catch (e) {
    main.append(refusal(e));
  }
}

void load();

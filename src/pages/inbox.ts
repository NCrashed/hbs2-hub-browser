// A maintainer's inbox: the letters waiting in the repository's mailbox, and
// accepting, rejecting or honouring each one (PEP-24 phase 3).
//
// An extension page, so it may write; every write is rehearsed first and the
// dry run is shown under the letter, with the button that signs. A letter is
// a stranger's bytes: its title and body are drawn as text and through the
// extension's own Markdown reader, as everywhere else.
import { HubError, call, changed, restartHost } from "../lib/client.ts";
import { roleOf, textOf } from "../lib/compose.ts";
import { asIndex, asLetter, asQueue } from "../lib/docs.ts";
import type { LetterDoc, QueueLetter } from "../lib/docs.ts";
import { el, markdownEl, shortKey } from "../lib/dom.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { ago } from "../lib/query.ts";
import { identiconEl } from "../lib/identicon.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
const repo = q.get("key") ?? "";
const gh = q.get("gh") ?? "";
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

function message(e: unknown): HTMLElement {
  const m = e instanceof Error ? e.message : String(e);
  if (/unknown argument\(s\)/.test(m) || (e instanceof HubError && e.error.meaning === "unknown-tool")) {
    const again = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Restart the host and try again");
    again.addEventListener("click", () => { void restartHost().then(() => location.reload()); });
    return el("div", { class: "hbs2-flash is-error" },
      el("p", {}, "The hbs2-hub answering here is older than this extension; update it to 0.26.0.1 or later."),
      el("div", { class: "hbs2-actions" }, again), el("p", { class: "hbs2-muted" }, m));
  }
  return el("div", { class: "hbs2-flash is-error" }, el("pre", { class: "hbs2-out" }, m));
}

function header(n: number | null): HTMLElement {
  const refresh = el("button", { type: "button", class: "hbs2-btn" }, "Refresh");
  refresh.addEventListener("click", () => void load());
  return el("div", { class: "hbs2-c-header hbs2-inbox-head" },
    el("div", {},
      el("h1", {}, "Inbox"),
      el("p", { class: "hbs2-muted" }, gh ? `${gh} \u00b7 ` : "", "hbs23://", el("code", { title: repo }, shortKey(repo)),
        n !== null ? ` \u00b7 ${n} ${n === 1 ? "letter" : "letters"} waiting` : "")),
    refresh);
}

// The verbs a letter can be answered with, each rehearsed before it signs.
function answer(l: QueueLetter, card: HTMLElement, panel: HTMLElement): HTMLElement {
  const op = OPS[l.op ?? ""] ?? { label: l.op ?? "letter", verb: "accept" as const };
  const yes = el("button", { type: "button", class: "hbs2-btn is-primary" }, op.verb === "honour" ? "Honour" : "Accept");
  const no = el("button", { type: "button", class: "hbs2-btn" }, "Reject");
  const silent = el("input", { type: "checkbox" });
  const result = el("div", { class: "hbs2-confirm" });

  const run = async (tool: string, args: { [k: string]: string | boolean }, publish: boolean, doneText: string) => {
    yes.disabled = no.disabled = true;
    const status = el("p", { class: "hbs2-muted" }, "Rehearsing");
    result.replaceChildren(status);
    let rehearsal;
    try {
      rehearsal = textOf(await call(tool, { ...args, dry_run: true }, (p) => { status.textContent = p; }));
    } catch (e) {
      result.replaceChildren(message(e));
      yes.disabled = no.disabled = false;
      return;
    }
    const go = el("button", { type: "button", class: "hbs2-btn is-primary" },
      tool === "inbox_reject" ? "Reject it" : publish ? "Sign and publish" : "Sign");
    const back = el("button", { type: "button", class: "hbs2-btn" }, "Not now");
    result.replaceChildren(
      el("p", { class: "hbs2-muted" }, "A dry run of exactly this, with nothing signed or sent:"),
      el("pre", { class: "hbs2-out" }, [rehearsal.text, rehearsal.notes].filter(Boolean).join("\n") || "(no output)"),
      el("p", { class: "hbs2-warn-line" }, tool === "inbox_reject"
        ? "The letter is dropped from the mailbox for every peer; it cannot be brought back."
        : "Canon is append-only: once published this is public and permanent in every clone."),
      el("div", { class: "hbs2-actions" }, back, go));
    back.addEventListener("click", () => { result.replaceChildren(); yes.disabled = no.disabled = false; });
    go.addEventListener("click", async () => {
      go.disabled = back.disabled = true;
      const st = el("p", { class: "hbs2-muted" }, "Signing");
      result.append(st);
      try {
        const out = textOf(await call(tool, args, (p) => { st.textContent = p; }));
        if (publish) {
          st.textContent = "Publishing canon";
          await call("publish", { repo }, (p) => { st.textContent = p; });
        }
        await changed(tab, repo).catch(() => {});
        card.classList.add("is-done");
        panel.replaceChildren(el("div", { class: "hbs2-flash is-ok" }, el("strong", {}, doneText),
          el("pre", { class: "hbs2-out" }, out.text)));
      } catch (e) {
        st.replaceChildren(el("strong", {}, "It did not go through."));
        result.append(message(e));
        go.disabled = back.disabled = false;
      }
    });
  };

  yes.addEventListener("click", () => void run(op.verb === "honour" ? "inbox_honour" : "inbox_accept",
    { repo, message: l.message }, true, op.verb === "honour" ? "Honoured and published." : "Accepted and published."));
  no.addEventListener("click", () => void run("inbox_reject",
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
        : el("div", {}), answer(l, box, panel));
    } catch (e) {
      loaded = false;
      panel.replaceChildren(message(e));
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
    main.append(message(e));
  }
}

void load();

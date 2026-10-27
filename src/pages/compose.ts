// A form that writes: a new issue, a comment, a pull request, a merge.
//
// THE ONLY PLACE THE EXTENSION SIGNS ANYTHING (PEP-24, threat model). It is an
// extension page, so the background worker lets it call a tool that writes,
// and it does so in three steps the person sees: the form, then a review that
// runs the tool with dry_run and shows what came back, then the write itself.
// Nothing is signed before "Sign and send" is pressed on the review.
//
// What the GitHub page passed in (a repository key, a thread number, a draft
// comment) is shown back here in fields the person can read and change; none
// of it is acted on without the review.
import { HubError, call, changed, restartHost } from "../lib/client.ts";
import { missing, planOf, roleOf, textOf, defaultOnto, NO_ROLE } from "../lib/compose.ts";
import type { Form, Op, Plan, Role, Target } from "../lib/compose.ts";
import { asThread } from "../lib/docs.ts";
import type { ThreadDoc } from "../lib/docs.ts";
import { el, markdownEl, shortKey } from "../lib/dom.ts";
import { editor } from "../lib/editor.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { iconEl } from "../lib/threadview.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;

const op = (["issue", "comment", "pr", "land"] as const).find((o) => o === q.get("op")) ?? null;
const repo = q.get("key") ?? "";
const kind: "issue" | "pr" = q.get("kind") === "pr" || op === "pr" || op === "land" ? "pr" : "issue";
const numberText = q.get("number");
const number = numberText && /^\d{1,9}$/.test(numberText) ? Number(numberText) : null;
const tabText = q.get("tab");
const tab = tabText && /^\d{1,12}$/.test(tabText) ? Number(tabText) : null;
const gh = q.get("gh") ?? "";

const TITLES: Record<Op, string> = {
  issue: "New issue on hbs2",
  comment: "Comment on hbs2",
  pr: "New pull request on hbs2",
  land: "Merge pull request",
};

function fail(e: unknown): HTMLElement {
  const err = e instanceof HubError ? e.error : null;
  const message = e instanceof Error ? e.message : String(e);
  if (err?.meaning === "no-clone") {
    return el("div", { class: "hbs2-flash is-error" },
      el("p", {}, "Writing needs a working clone of this repository on this machine, and none is set."),
      el("p", {}, "Clone it, or name the one you have:"),
      el("pre", {}, `git clone hbs23://${repo} <dir>\ngit config --global hbs2-hub.${repo}.clone <dir>`));
  }
  // A host older than this extension: it refuses an argument or a tool this
  // page was written for. Say that, and how to fix it, rather than the refusal.
  if (/unknown argument\(s\)/.test(message) || err?.meaning === "unknown-tool" || err?.meaning === "not-allowed") {
    // The host keeps running after an upgrade, so the new one is started from here.
    const again = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Restart the host and try again");
    again.addEventListener("click", () => { void restartHost().then(() => location.reload()); });
    return el("div", { class: "hbs2-flash is-error" },
      el("p", {}, "The hbs2-hub answering here is older than this extension. Writing needs 0.26.0.1 or later."),
      el("p", {}, "Update it and let it write the browser's launcher again:"),
      el("pre", {}, `nix profile upgrade hbs2\nhbs2-hub native-host --install --chrome-id ${chrome.runtime.id}`),
      el("p", {}, "If you have updated already, the old one is still running:"),
      el("div", { class: "hbs2-actions" }, again),
      el("p", { class: "hbs2-muted" }, message));
  }
  if (/author|sender/.test(message) && /no (author|sender)/.test(message)) {
    return el("div", { class: "hbs2-flash is-error" },
      el("p", {}, "A letter is signed by your identity, and this machine has none yet. Make one with:"),
      el("pre", {}, "hbs2-hub identity init"));
  }
  return el("div", { class: "hbs2-flash is-error" }, el("pre", { class: "hbs2-out" }, message));
}

function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  return el("label", { class: "hbs2-field" },
    el("span", { class: "hbs2-flabel" }, label), input,
    hint ? el("span", { class: "hbs2-hint hbs2-muted" }, hint) : null);
}

function select(options: string[], chosen: string): HTMLSelectElement {
  const s = el("select", { class: "hbs2-input" });
  const all = options.includes(chosen) || !chosen ? options : [chosen, ...options];
  for (const o of all) {
    const opt = el("option", { value: o }, o);
    if (o === chosen) opt.selected = true;
    s.append(opt);
  }
  return s;
}

function header(t: ThreadDoc | null): HTMLElement {
  return el("div", { class: "hbs2-c-header" },
    el("h1", {}, op ? TITLES[op] : "hbs2-hub"),
    el("p", { class: "hbs2-muted" },
      gh ? `${gh} \u00b7 ` : "", "hbs23://", el("code", { title: repo }, shortKey(repo)),
      t ? el("span", {}, " \u00b7 ", el("bdi", {}, `${t.title ?? ""}`), ` #${t.number ?? "?"}`) : null));
}

// The form for this op; resolves with what was typed.
function form(role: Role, t: ThreadDoc | null, again: Form): Promise<Form> {
  return new Promise((done) => {
    const parts: HTMLElement[] = [];
    let read: () => Form = () => ({});

    if (op === "issue" || op === "pr") {
      const title = el("input", { class: "hbs2-input hbs2-title-in", placeholder: "Title", value: again.title ?? "" });
      const ed = editor({ initial: again.body ?? "", placeholder: op === "pr" ? "What does this change, and why?" : "Describe the problem, and how to reproduce it." });
      parts.push(field("Add a title", title), field("Add a description", ed.node));
      if (op === "issue") {
        const labels = el("input", { class: "hbs2-input", placeholder: "bug, docs", value: again.labels ?? "" });
        parts.push(field("Labels", labels, role.maintainer ? "Comma separated. Applied." : "Comma separated. Asked for; a maintainer applies labels."));
        read = () => ({ title: title.value, body: ed.value(), labels: labels.value });
      } else {
        const from = select(role.branches, again.from ?? role.branch ?? "");
        const onto = select(role.branches, again.onto ?? defaultOnto(role));
        parts.push(el("div", { class: "hbs2-branches" },
          field("Merge into", onto), field("From", from)));
        parts.push(el("p", { class: "hbs2-hint hbs2-muted" },
          "The branches of your working clone. Only the commits on From that are not on the target travel."));
        read = () => ({ title: title.value, body: ed.value(), from: from.value, onto: onto.value });
      }
    } else if (op === "comment") {
      const ed = editor({ initial: again.body ?? q.get("body") ?? "", placeholder: "Leave a comment" });
      parts.push(field("Add a comment", ed.node));
      read = () => ({ body: ed.value() });
    } else if (op === "land") {
      const pr = t?.pr;
      const msg = el("textarea", { class: "hbs2-input", rows: "3", placeholder: "Default: Merge hbs2 pull request #N from <branch>, and the title" }, again.message ?? "");
      const noMirror = el("input", { type: "checkbox" });
      noMirror.checked = again.noMirror ?? false;
      parts.push(
        el("div", { class: "hbs2-landsum" },
          el("span", { class: "hbs2-state is-open" }, iconEl("pr-open"), "Open"), " ",
          pr ? el("span", {}, "into ", el("code", {}, pr.onto.replace(/^refs\/heads\//, "")),
                  pr.source_ref ? el("span", {}, " from ", el("code", {}, pr.source_ref)) : null,
                  ", tip ", el("code", { title: pr.tip }, pr.tip.slice(0, 7))) : null),
        field("Commit message", msg),
        el("label", { class: "hbs2-check" }, noMirror, " Push to the hbs2 remote only (not to origin as well)"));
      read = () => ({ message: msg.value, noMirror: noMirror.checked });
    }

    const err = el("div", {});
    const review = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Review");
    review.addEventListener("click", () => {
      const f = read();
      const why = op ? missing(op, f) : "Nothing to do.";
      if (why) { err.replaceChildren(el("div", { class: "hbs2-flash is-error" }, why)); return; }
      done(f);
    });

    main.replaceChildren(header(t),
      el("div", { class: "hbs2-role hbs2-muted" },
        role.maintainer
          ? el("span", {}, "You maintain this repository (", el("code", { title: role.signer ?? "" }, shortKey(role.signer ?? "")), ").")
          : "You are writing as a contributor: this goes to the project as a letter."),
      ...parts, err,
      el("div", { class: "hbs2-actions" }, review));
  });
}

// The review: what dry_run said, and the one button that signs.
function reviewed(plan: Plan, rehearsal: string, notes: string): Promise<boolean> {
  return new Promise((done) => {
    const back = el("button", { type: "button", class: "hbs2-btn" },
      op === "land" ? "Change options" : op === "comment" ? "Edit here" : "Back to the form");
    const body = typeof plan.args["body"] === "string" ? plan.args["body"] : "";
    const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, plan.tool === "pr_land" ? "Merge, push and publish" : "Sign and send");
    back.addEventListener("click", () => done(false));
    go.addEventListener("click", () => done(true));
    main.replaceChildren(...[header(null),
      el("h2", {}, "Review"),
      el("p", {}, plan.what),
      body ? el("div", { class: "hbs2-c-box hbs2-reviewed" },
        el("div", { class: "hbs2-c-head" }, el("strong", {}, op === "comment" ? "Your comment" : "The description")),
        el("div", { class: "hbs2-c-body" }, markdownEl(body))) : null,
      el("table", { class: "hbs2-sum" },
        el("tr", {}, el("td", {}, "Tool"), el("td", {}, el("code", {}, plan.tool))),
        el("tr", {}, el("td", {}, "Repository"), el("td", {}, el("code", {}, repo))),
        plan.publish ? el("tr", {}, el("td", {}, "Then"), el("td", {}, el("code", {}, "publish"), " canon to the hbs2 remote")) : null),
      el("p", { class: "hbs2-muted" }, "A dry run of exactly this, with nothing signed or sent:"),
      el("pre", { class: "hbs2-out" }, rehearsal || "(no output)"),
      notes ? el("pre", { class: "hbs2-out hbs2-muted" }, notes) : null,
      el("p", { class: "hbs2-warn-line" },
        plan.tool.startsWith("issue_") && plan.publish || plan.tool === "pr_land"
          ? "Canon is append-only: once published this is public and permanent in every clone."
          : "A sent letter cannot be recalled."),
      el("div", { class: "hbs2-actions" }, back, go)].filter((x): x is HTMLElement => x !== null));
  });
}

async function main_(): Promise<void> {
  if (!op || !isRepoKey(repo) || ((op === "comment" || op === "land") && number === null)) {
    main.replaceChildren(el("p", {}, "This link does not name something to write."));
    return;
  }
  const target: Target = { repo, kind, number };
  main.replaceChildren(header(null), el("p", { class: "hbs2-muted" }, "Asking the working clone who you are here"));

  let role: Role = NO_ROLE;
  try {
    role = roleOf(await call("status", { repo, local: true }));
  } catch (e) {
    main.append(fail(e));
    return;
  }

  let thread: ThreadDoc | null = null;
  if (number !== null) {
    try { thread = asThread(await call(`${kind}_show`, { repo, number })); } catch (e) { main.append(fail(e)); return; }
  }
  if (op === "land" && !role.maintainer) {
    main.replaceChildren(header(thread), el("div", { class: "hbs2-flash is-error" },
      "Merging needs a maintainer key in this clone, and the key it signs with is not one."));
    return;
  }

  // WHAT WAS TYPED ON THE PAGE goes straight to the review: a comment written
  // under the thread, a merge with its defaults. The review is where it is
  // read back and signed, so asking for it a second time was only a chore.
  const draft = q.get("body") ?? "";
  let f: Form = op === "comment" && draft.trim() ? { body: draft } : {};
  let skip = (op === "comment" && draft.trim() !== "") || op === "land";
  for (;;) {
    if (!skip) f = await form(role, thread, f);
    skip = false;
    const plan = planOf(op, role, f, target);
    const progress = el("p", { class: "hbs2-muted" }, "Rehearsing");
    main.replaceChildren(header(thread), progress);
    let r;
    try {
      r = textOf(await call(plan.tool, { ...plan.args, dry_run: true }, (p) => { progress.textContent = p; }));
    } catch (e) {
      main.append(fail(e), backTo());
      await clicked();
      continue;
    }
    if (!(await reviewed(plan, r.text, r.notes))) continue;

    const log = el("pre", { class: "hbs2-out" });
    const status = el("p", { class: "hbs2-muted" }, plan.tool === "pr_land" ? "Merging" : "Signing and sending");
    main.replaceChildren(header(thread), status, log);
    try {
      const out = textOf(await call(plan.tool, plan.args, (p) => { status.textContent = p; }));
      // The verb says canon is not published yet when it is not; here publish
      // runs next, and the sentence would be wrong by the time it is read.
      const notes = plan.publish ? out.notes.replace(/not published yet:[\s\S]*?no clone sees it\.?/, "").trim() : out.notes;
      log.textContent = [out.text, notes].filter(Boolean).join("\n");
      if (plan.publish) {
        status.textContent = "Publishing canon";
        const pub = textOf(await call("publish", { repo }, (p) => { status.textContent = p; }));
        log.textContent += "\n" + pub.text;
      }
    } catch (e) {
      status.replaceChildren(el("strong", {}, "It did not go through."));
      main.append(fail(e), backTo());
      await clicked();
      continue;
    }
    await changed(tab, repo).catch(() => {});
    const close = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Close");
    close.addEventListener("click", () => window.close());
    status.replaceChildren(el("strong", {}, plan.publish || plan.tool === "pr_land" ? "Done, and published." : "Sent."),
      plan.publish || plan.tool === "pr_land" ? "" : " It shows up on the page once a maintainer accepts it.");
    main.append(el("div", { class: "hbs2-actions" }, close));
    return;
  }
}

let resume: (() => void) | null = null;
function backTo(): HTMLElement {
  const b = el("button", { type: "button", class: "hbs2-btn" }, "Back to the form");
  b.addEventListener("click", () => resume?.());
  return el("div", { class: "hbs2-actions" }, b);
}
function clicked(): Promise<void> {
  return new Promise((r) => { resume = r; });
}

void main_();

// One thread, in the extension's own page: the same view as on GitHub.
import { call, canWrite, open } from "../lib/client.ts";
import { siteBar } from "../lib/bar.ts";
import { roleOf } from "../lib/compose.ts";
import { threadActions } from "../lib/actions.ts";
import { asThread } from "../lib/docs.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { el } from "../lib/dom.ts";
import { threadView } from "../lib/threadview.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;
siteBar(isRepoKey(q.get("key") ?? "") ? q.get("key") : null);

async function main_(): Promise<void> {
  const key = q.get("key") ?? "";
  const number = Number(q.get("number"));
  const kind = q.get("kind") === "pr" ? "pr" : "issue";
  const gh = q.get("gh") ?? "";
  if (!isRepoKey(key) || !Number.isInteger(number) || number < 1) {
    main.replaceChildren(el("p", {}, "This link does not name a thread."));
    return;
  }
  main.replaceChildren(el("p", { class: "muted", id: "progress" }, "loading"));
  try {
    const t = asThread(await call(`${kind}_show`, { repo: key, number }, (p) => {
      document.getElementById("progress")!.textContent = p;
    }));
    document.title = `${t.title ?? ""} #${t.number ?? "?"}`;
    // A public server writes nothing: no comment box, no maintainer's tools.
    const writable = await canWrite();
    main.replaceChildren(threadView(t, {
      repo: key,
      back: { label: gh || (kind === "pr" ? "Pull requests" : "Issues"),
              go: () => { location.href = `repo.html?${new URLSearchParams({ key, ...(gh ? { gh } : {}), tab: kind === "pr" ? "pulls" : "issues" })}`; } },
      ...(writable ? { actions: threadActions({
        compose: (p) => void open("compose", p), key, gh, kind, number,
        maintains: call("status", { repo: key, local: true }).then((v) => roleOf(v).maintainer, () => false),
      }) } : {}),
    }));
  } catch (e) {
    main.replaceChildren(el("p", {}, e instanceof Error ? e.message : String(e)));
  }
}

// A form opened from here finished writing: draw the thread again. On the web
// the form was this tab, and coming back to the page shows it again.
if (__WEB__) addEventListener("pageshow", (e) => { if (e.persisted) void main_(); });
else chrome.runtime.onMessage.addListener((m: { kind?: string }) => {
  if (m?.kind === "hbs2-changed") void main_();
});

void main_();

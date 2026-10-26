// One thread, in the extension's own page: the same view as on GitHub.
import { call } from "../lib/client.ts";
import { asThread } from "../lib/docs.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { el } from "../lib/dom.ts";
import { threadView } from "../lib/threadview.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;

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
    main.replaceChildren(threadView(t, {
      repo: key,
      back: { label: gh || "Repository", go: () => { location.href = `repo.html?${new URLSearchParams({ key, gh })}`; } },
    }));
  } catch (e) {
    main.replaceChildren(el("p", {}, e instanceof Error ? e.message : String(e)));
  }
}

void main_();

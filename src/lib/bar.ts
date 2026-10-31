// The web build's top bar (PEP-25): the way home, the repository a page is
// about, and which kind of server this is. Nothing in the extension's build.
import { el, shortKey } from "./dom.ts";
import { serverHello, takeToken } from "./web.ts";
import { aboutRepo } from "./repohead.ts";
import { call } from "./client.ts";
import { syncRepository } from "./repostate.ts";

function localSyncButton(repo: string | null): HTMLButtonElement {
  const button = el("button", { type: "button", class: "hbs2-sync", hidden: "hidden" }, "Sync");
  if (!repo) return button;
  void serverHello().then((h) => {
    if (h.mode === "local" && !h.read_only) button.removeAttribute("hidden");
  }, () => {});
  button.addEventListener("click", async () => {
    button.setAttribute("disabled", "disabled");
    button.replaceChildren("Syncing...");
    button.title = "";
    try {
      await syncRepository(repo, call, () => location.reload(), (p) => { button.title = p; });
    } catch (e) {
      button.replaceChildren("Sync failed");
      button.title = e instanceof Error ? e.message : String(e);
      button.removeAttribute("disabled");
    }
  });
  return button;
}

/** Call first on every web page: it also takes the token out of the address. */
export function siteBar(repo: string | null, root = ".."): void {
  if (!__WEB__) return;
  takeToken();
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `${root}/web.css`;
  document.head.append(css);
  const mode = el("span", { class: "hbs2-mode" });
  const sync = localSyncButton(repo);
  const here = repo ? el("a", { href: `${root === "." ? "./pages/" : ""}${__WEB__ ? "code" : "repo"}.html?${new URLSearchParams({ key: repo })}`, title: repo }, shortKey(repo)) : null;
  const bar = el("header", { class: "hbs2-site" },
    el("a", { href: `${root}/index.html`, class: "hbs2-home" },
      el("img", { src: `${root}/icons/icon-32.png`, alt: "", width: "24", height: "24" }), "hbs2-hub"),
    here ? el("span", { class: "hbs2-crumb" }, "/", here) : null,
    el("span", { class: "hbs2-spacer" }),
    sync,
    mode);
  document.body.prepend(bar);
  // The repository's name once its manifest answers; the key until then, and
  // for good when it names none.
  if (repo && here) void aboutRepo(repo).then((a) => { if (a.name) here.replaceChildren(el("bdi", {}, a.name)); });
  void serverHello().then((h) => {
    mode.replaceChildren(h.mode === "public" ? "Public, read-only" : "Local");
    mode.classList.add(h.mode === "public" ? "is-public" : "is-local");
  }, () => { mode.replaceChildren("not connected"); });
}

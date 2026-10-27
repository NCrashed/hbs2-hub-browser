// The web build's home page (PEP-25): the repositories this server shows.
// A public server shows the ones its operator named; a local one, the working
// clones the user named with `git config hbs2-hub.<key>.clone`, and any other
// key typed in.
import { siteBar } from "../lib/bar.ts";
import { el, shortKey } from "../lib/dom.ts";
import { identiconEl } from "../lib/identicon.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { serverHello } from "../lib/web.ts";

siteBar(null, ".");
const main = document.querySelector("main")!;

function repoLink(key: string): string {
  return `./pages/repo.html?${new URLSearchParams({ key })}`;
}

async function load(): Promise<void> {
  let hello;
  try {
    hello = await serverHello();
  } catch (e) {
    main.replaceChildren(el("div", { class: "hbs2-flash is-error" }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const local = hello.mode === "local";
  const items = hello.repos.map((k) => el("div", { class: "hbs2-home-item" }, identiconEl(k, 32),
    el("div", {}, el("a", { href: repoLink(k) }, shortKey(k)),
      el("div", { class: "hbs2-muted hbs2-small" }, el("code", {}, `hbs23://${k}`)))));
  const parts: HTMLElement[] = [
    el("h1", {}, local ? "Your repositories" : "Repositories"),
    items.length ? el("div", { class: "hbs2-home-list" }, ...items)
      : el("p", { class: "hbs2-muted" }, local
          ? "No working clone is named yet: `git config --global hbs2-hub.<key>.clone <dir>` names one. Any repository can be opened below."
          : "This server shows no repository."),
  ];
  if (local) {
    const input = el("input", { class: "hbs2-input", placeholder: "hbs23://<repository key>, or the key" });
    const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Open");
    const err = el("div", {});
    const open = () => {
      const k = input.value.trim().replace(/^hbs23:\/\//, "");
      if (!isRepoKey(k)) { err.replaceChildren(el("div", { class: "hbs2-flash is-error" }, "That is not a repository key.")); return; }
      location.href = repoLink(k);
    };
    go.addEventListener("click", open);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    parts.push(el("h2", {}, "Open a repository"), el("div", { class: "hbs2-open" }, input, go), err);
  }
  main.replaceChildren(...parts);
}

void load();

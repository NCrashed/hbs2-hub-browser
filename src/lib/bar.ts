// The web build's top bar (PEP-25): the way home, the repository a page is
// about, and which kind of server this is. Nothing in the extension's build.
import { el, shortKey } from "./dom.ts";
import { serverHello, takeToken } from "./web.ts";

/** Call first on every web page: it also takes the token out of the address. */
export function siteBar(repo: string | null, root = ".."): void {
  if (!__WEB__) return;
  takeToken();
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `${root}/web.css`;
  document.head.append(css);
  const mode = el("span", { class: "hbs2-mode" });
  const bar = el("header", { class: "hbs2-site" },
    el("a", { href: `${root}/index.html`, class: "hbs2-home" },
      el("img", { src: `${root}/icons/icon-32.png`, alt: "", width: "24", height: "24" }), "hbs2-hub"),
    repo ? el("span", { class: "hbs2-crumb" }, "/",
      el("a", { href: `${root === "." ? "./pages/" : ""}repo.html?${new URLSearchParams({ key: repo })}`, title: repo }, shortKey(repo))) : null,
    el("span", { class: "hbs2-spacer" }),
    mode);
  document.body.prepend(bar);
  void serverHello().then((h) => {
    mode.replaceChildren(h.mode === "public" ? "Public, read-only" : "Local");
    mode.classList.add(h.mode === "public" ? "is-public" : "is-local");
  }, () => { mode.replaceChildren("not connected"); });
}

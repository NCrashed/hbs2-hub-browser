// A repository's header, as GitHub draws its own: what the repository calls
// itself (the manifest's name and description, PEP-25), how to clone it, and
// the tabs. Shared by the code page and the issue and pull request page.
import { call } from "./client.ts";
import { el, shortKey } from "./dom.ts";
import { identiconEl } from "./identicon.ts";
import { iconEl } from "./threadview.ts";
import type { Json } from "./protocol.ts";

export interface About { name: string | null; description: string | null }

/** The manifest's name and description, when the host can say (the code view's refs). */
export function aboutOf(refs: Json): About {
  const o = refs && typeof refs === "object" && !Array.isArray(refs) ? refs : null;
  const s = (v: Json | undefined) => (typeof v === "string" && v.trim() ? v : null);
  return { name: s(o?.["name"]), description: s(o?.["description"]) };
}

export type Tab = "code" | "issues" | "pulls" | "inbox" | "maintainers";

export function repoHeader(key: string, about: About, active: Tab, o: {
  gh?: string;
  counts?: { issues?: number; pulls?: number };
  maintainer?: boolean;
  /** The Code tab: only where the host shows code (the web build). */
  code?: boolean;
}): HTMLElement {
  const gh = o.gh ?? "";
  const q = (extra: Record<string, string>) => new URLSearchParams({ key, ...(gh ? { gh } : {}), ...extra });
  const link = (label: string, icon: string, href: string, tab: Tab, count?: number) =>
    el("a", { href, class: active === tab ? "is-selected" : "" }, iconEl(icon), label,
      count !== undefined ? el("span", { class: "hbs2-tab-count" }, String(count)) : null);
  const title = gh ? el("strong", {}, gh) : about.name ? el("strong", { title: key }, el("bdi", {}, about.name)) : el("strong", { title: key }, shortKey(key));
  return el("div", { class: "hbs2-repohead" },
    el("div", { class: "hbs2-repo-head" },
      el("div", {},
        el("h1", {}, identiconEl(key, 24), " ", title),
        about.description ? el("p", { class: "hbs2-repo-desc" }, el("bdi", {}, about.description)) : null),
      el("code", { class: "hbs2-clone", title: "clone it" }, `git clone hbs23://${key}`)),
    el("nav", { class: "hbs2-repo-tabs" },
      o.code ? link("Code", "code", `code.html?${q({})}`, "code") : null,
      link("Issues", "issue-open", `repo.html?${q({ tab: "issues" })}`, "issues", o.counts?.issues),
      link("Pull requests", "pr-open", `repo.html?${q({ tab: "pulls" })}`, "pulls", o.counts?.pulls),
      o.maintainer ? link("Inbox", "comment", `inbox.html?${q({})}`, "inbox") : null,
      o.maintainer ? link("Maintainers", "file", `maintainers.html?${q({})}`, "maintainers") : null));
}

/** The name and description, or nothing: a host without the code view says neither. */
export async function aboutRepo(key: string): Promise<About> {
  try { return aboutOf(await call("code_refs", { repo: key })); } catch { return { name: null, description: null }; }
}

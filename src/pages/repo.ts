// A repository's hbs2 issues and pull requests.
import { call, pointer } from "../lib/client.ts";
import { asIndex, newerContract } from "../lib/docs.ts";
import type { IndexRow } from "../lib/docs.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { el, shortKey, when } from "../lib/dom.ts";

const q = new URLSearchParams(location.search);
const main = document.querySelector("main")!;

async function keyOf(): Promise<string | null> {
  const k = q.get("key");
  if (k && isRepoKey(k)) return k;
  const gh = q.get("gh");
  const m = gh ? /^([^/]+)\/([^/]+)$/.exec(gh) : null;
  if (!m || !m[1] || !m[2]) return null;
  return (await pointer(m[1], m[2])).key;
}

function section(title: string, rows: IndexRow[], key: string): HTMLElement {
  const gh = q.get("gh") ?? "";
  return el("section", {},
    el("h2", {}, `${title} (${rows.length})`),
    rows.length === 0 ? el("p", { class: "muted" }, "none") :
    el("table", {},
      el("tbody", {}, ...rows.map((t) =>
        el("tr", {},
          el("td", { class: "num" }, `#${t.number ?? "?"}`),
          el("td", {}, el("a", { href: `thread.html?${new URLSearchParams({ key, kind: t.kind, number: String(t.number ?? ""), gh })}` },
            t.redacted ? "(redacted)" : t.title ?? "")),
          el("td", {}, el("span", { class: `status ${t.status}` }, t.status)),
          el("td", { class: "muted" }, t.labels.join(", ")),
          el("td", { class: "muted" }, `${t.comments} comments`),
          el("td", { class: "muted" }, when(t.updated_at)),
          el("td", {}, shortKey(t.author)))))));
}

async function main_(): Promise<void> {
  const key = await keyOf();
  if (!key) {
    main.replaceChildren(el("p", {}, "This repository has no hbs2 side: no .hbs2/hub file and no mapping in the extension's options."));
    return;
  }
  const gh = q.get("gh");
  document.title = `hbs2: ${gh ?? key}`;
  main.replaceChildren(
    el("h1", {}, gh ?? "hbs2 repository"),
    el("p", { class: "muted" }, "hbs23://", el("code", {}, key)),
    el("p", { class: "muted", id: "progress" }, "loading"),
  );
  const progress = (t: string) => { document.getElementById("progress")!.textContent = t; };
  try {
    const [issues, prs] = await Promise.all([
      call("issue_list", { repo: key }, progress).then(asIndex),
      call("pr_list", { repo: key }, progress).then(asIndex),
    ]);
    document.getElementById("progress")!.remove();
    if (newerContract(issues)) main.append(el("p", { class: "warn" }, "The host speaks a newer contract than this extension; update it."));
    main.append(section("Issues", issues.threads, key), section("Pull requests", prs.threads, key));
  } catch (e) {
    progress(e instanceof Error ? e.message : String(e));
  }
}

void main_();

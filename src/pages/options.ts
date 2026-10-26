// Which GitHub repository points at which hbs2 repository: the pins and the hand mappings.
import { isRepoKey } from "../lib/pointer.ts";
import { el } from "../lib/dom.ts";

type Map_ = Record<string, string>;
const main = document.querySelector("main")!;

async function load(): Promise<{ pins: Map_; hand: Map_ }> {
  const s = (await chrome.storage.local.get(["pins", "hand"])) as { pins?: Map_; hand?: Map_ };
  return { pins: s.pins ?? {}, hand: s.hand ?? {} };
}

function table(title: string, m: Map_, drop: (k: string) => void, note: string): HTMLElement {
  const rows = Object.entries(m).sort();
  return el("section", {},
    el("h2", {}, title), el("p", { class: "muted" }, note),
    rows.length === 0 ? el("p", { class: "muted" }, "none") :
    el("table", {}, el("tbody", {}, ...rows.map(([gh, key]) => {
      const b = el("button", {}, "remove");
      b.addEventListener("click", () => drop(gh));
      return el("tr", {}, el("td", {}, gh), el("td", {}, el("code", {}, key)), el("td", {}, b));
    }))));
}

async function draw(): Promise<void> {
  const { pins, hand } = await load();
  const gh = el("input", { placeholder: "owner/repo", size: "30" });
  const key = el("input", { placeholder: "hbs2 repository key", size: "50" });
  const add = el("button", {}, "map");
  const msg = el("span", { class: "muted" });
  add.addEventListener("click", async () => {
    const g = gh.value.trim().toLowerCase();
    const k = key.value.trim().replace(/^hbs23:\/\//, "");
    if (!/^[a-z0-9-]+\/[a-z0-9._-]+$/.test(g)) return void (msg.textContent = "owner/repo, as in the GitHub URL");
    if (!isRepoKey(k)) return void (msg.textContent = "not a repository key");
    hand[g] = k;
    await chrome.storage.local.set({ hand });
    void draw();
  });
  main.replaceChildren(
    el("h1", {}, "hbs2-hub"),
    table("Mapped by hand", hand, async (g) => { delete hand[g]; await chrome.storage.local.set({ hand }); void draw(); },
      "These win over a repository's .hbs2/hub file."),
    el("p", {}, gh, " ", key, " ", add, " ", msg),
    table("Pinned from .hbs2/hub", pins, async (g) => { delete pins[g]; await chrome.storage.local.set({ pins }); void draw(); },
      "The key a repository's pointer named the first time you opened it. If the file later names another, the pinned one is kept and you are told. Remove a pin to accept the new key."),
    el("h2", {}, "The native host"),
    el("p", {}, "This extension talks to hbs2-hub on this machine. Set it up once with:"),
    el("pre", {}, `hbs2-hub native-host --install --chrome-id ${chrome.runtime.id}`),
    el("p", { class: "muted" }, "In Firefox the --chrome-id part is not needed. For writes, tell it where your clone is: git config --global hbs2-hub.<repo-key>.clone <path>"),
  );
}

void draw();

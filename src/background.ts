// The one connection to `hbs2-hub native-host`, and the rule about who may ask it what.
import { HOST_NAME, mayCall, toolInfo } from "./lib/protocol.ts";
import type { Answer, Envelope, HostReply, Json, TabNote, ToolInfo } from "./lib/protocol.ts";
import { parsePointer, pointerUrl } from "./lib/pointer.ts";

let port: chrome.runtime.Port | null = null;
let nextId = 1;
const pending = new Map<number, { onProgress: (t: string) => void; done: (r: HostReply) => void }>();
let table: Map<string, ToolInfo> | null = null;

function host(): chrome.runtime.Port {
  if (port) return port;
  const p = chrome.runtime.connectNative(HOST_NAME);
  p.onMessage.addListener((m: HostReply) => {
    const w = pending.get(m.id);
    if (!w) return;
    if ("progress" in m) w.onProgress(m.progress);
    else {
      pending.delete(m.id);
      w.done(m);
    }
  });
  p.onDisconnect.addListener(() => {
    const why = chrome.runtime.lastError?.message ?? "the native host went away";
    port = null;
    table = null;
    for (const [id, w] of pending) {
      w.done({ id, ok: false, error: { code: null, meaning: "no-host", message: hostAdvice(why) } });
    }
    pending.clear();
  });
  port = p;
  return p;
}

function hostAdvice(why: string): string {
  return `${why}. Is hbs2-hub installed and its browser host set up? Run: hbs2-hub native-host --install --chrome-id ${chrome.runtime.id}`;
}

function ask(op: string, extra: { [k: string]: Json }, onProgress: (t: string) => void = () => {}): Promise<HostReply> {
  return new Promise((done) => {
    const id = nextId++;
    pending.set(id, { onProgress, done });
    try {
      host().postMessage({ id, op, ...extra });
    } catch (e) {
      pending.delete(id);
      done({ id, ok: false, error: { code: null, meaning: "no-host", message: hostAdvice(String(e)) } });
    }
  });
}

async function tools(): Promise<Map<string, ToolInfo>> {
  if (table) return table;
  const r = await ask("tools", {});
  const t = new Map<string, ToolInfo>();
  if ("ok" in r && r.ok && r.result && typeof r.result === "object" && !Array.isArray(r.result)) {
    const list = r.result["tools"];
    if (Array.isArray(list)) for (const row of list) {
      const i = toolInfo(row);
      if (i) t.set(i.name, i);
    }
  }
  table = t;
  return t;
}

// A pointer is pinned per GitHub repository the first time it is seen, and a
// different one later is reported rather than followed (PEP-24, "A pointer that
// lies"). A hand mapping in the options page wins over both.
export interface PointerAnswer {
  key: string | null;
  /** A different key the file names now, when the pinned one was kept. */
  changed: string | null;
  source: "options" | "pinned" | ".hbs2/hub" | "none";
}

async function pointer(owner: string, repo: string): Promise<PointerAnswer> {
  const id = `${owner}/${repo}`.toLowerCase();
  const { pins = {}, hand = {} } = (await chrome.storage.local.get(["pins", "hand"])) as {
    pins?: Record<string, string>;
    hand?: Record<string, string>;
  };
  const byHand = hand[id];
  if (byHand) return { key: byHand, changed: null, source: "options" };
  let named: string | null = null;
  try {
    const res = await fetch(pointerUrl({ owner, repo, view: "code" }), { credentials: "omit", cache: "no-cache" });
    if (res.ok) named = parsePointer(await res.text());
  } catch {
    named = null;
  }
  const pinned = pins[id];
  if (!named) return { key: pinned ?? null, changed: null, source: pinned ? "pinned" : "none" };
  if (!pinned) {
    pins[id] = named;
    await chrome.storage.local.set({ pins });
    return { key: named, changed: null, source: ".hbs2/hub" };
  }
  return pinned === named
    ? { key: pinned, changed: null, source: ".hbs2/hub" }
    : { key: pinned, changed: named, source: "pinned" };
}

chrome.runtime.onConnect.addListener((p) => {
  // Who is asking is decided by where the port comes from, not by its name:
  // an extension page has the extension's own URL, a content script a tab URL.
  const own = p.sender?.url?.startsWith(chrome.runtime.getURL("")) === true;
  const from: "content" | "page" = own ? "page" : "content";

  p.onMessage.addListener(async (env: Envelope) => {
    const reply = (a: Answer) => {
      try { p.postMessage(a); } catch { /* the page went away */ }
    };
    const { seq, ask: q } = env;
    if (q.kind === "pointer") {
      const r = await pointer(q.owner, q.repo);
      reply({ kind: "result", seq, ok: true, result: r as unknown as Json });
    } else if (q.kind === "open") {
      if (q.page === "compose") {
        // A form in a window of its own, over the page it was opened from, as
        // GitHub's own dialogs sit over theirs. The tab it came from goes with
        // it, so that the page can be told to redraw when the write is done.
        const tab = p.sender?.tab?.id;
        const params = new URLSearchParams(q.params);
        if (tab !== undefined) params.set("tab", String(tab));
        await chrome.windows.create({ url: chrome.runtime.getURL("pages/compose.html") + "?" + params.toString(),
                                      type: "popup", width: 820, height: 860 });
      } else {
        const path = q.page === "repo" ? "pages/repo.html" : "pages/thread.html";
        await chrome.tabs.create({ url: chrome.runtime.getURL(path) + "?" + new URLSearchParams(q.params).toString() });
      }
      reply({ kind: "result", seq, ok: true, result: null });
    } else if (q.kind === "changed") {
      // From a form only: a GitHub page has nothing to announce.
      if (from === "page" && q.tab !== null) {
        const note: TabNote = { kind: "hbs2-changed", key: q.key };
        try { await chrome.tabs.sendMessage(q.tab, note); } catch { /* the tab went away */ }
        try { await chrome.tabs.update(q.tab, { active: true }); } catch { /* likewise */ }
      }
      reply({ kind: "result", seq, ok: true, result: null });
    } else if (q.kind === "call") {
      const t = await tools();
      if (!mayCall(from, q.tool, t)) {
        reply({ kind: "result", seq, ok: false, error: { code: null, meaning: "not-allowed",
          message: `${q.tool} may not be called from ${from === "content" ? "a GitHub page" : "here"}` } });
        return;
      }
      const r = await ask("call", { tool: q.tool, args: q.args }, (text) => reply({ kind: "progress", seq, text }));
      if ("ok" in r) reply(r.ok ? { kind: "result", seq, ok: true, result: r.result }
                                : { kind: "result", seq, ok: false, error: r.error });
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  const m = tab.url ? /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(tab.url) : null;
  const params: Record<string, string> = m && m[1] && m[2] ? { gh: `${m[1]}/${m[2]}` } : {};
  await chrome.tabs.create({ url: chrome.runtime.getURL("pages/repo.html") + "?" + new URLSearchParams(params).toString() });
});

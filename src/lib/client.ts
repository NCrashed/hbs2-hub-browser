// Asking the background worker, from a content script or an extension page.
//
// The same interface the standalone frontend will implement over HTTP
// (`hub serve`, PEP-24): a call names a tool and its arguments and gets back a
// document or a refusal, with progress on the way.
import type { Answer, Ask, Envelope, HostError, Json } from "./protocol.ts";
import { serverHello, webCall } from "./web.ts";

export class HubError extends Error {
  constructor(public readonly error: HostError) {
    super(error.message);
  }
}

let port: chrome.runtime.Port | null = null;
let seq = 1;
const waiting = new Map<number, { progress: (t: string) => void; ok: (v: Json) => void; fail: (e: HubError) => void }>();

function connect(): chrome.runtime.Port {
  if (port) return port;
  const p = chrome.runtime.connect({ name: "hub" });
  p.onMessage.addListener((a: Answer) => {
    const w = waiting.get(a.seq);
    if (!w) return;
    if (a.kind === "progress") return w.progress(a.text);
    waiting.delete(a.seq);
    if (a.ok) w.ok(a.result);
    else w.fail(new HubError(a.error));
  });
  p.onDisconnect.addListener(() => {
    port = null;
    for (const w of waiting.values()) w.fail(new HubError({ code: null, meaning: "disconnected", message: "the extension restarted; reload the page" }));
    waiting.clear();
  });
  port = p;
  return p;
}

function send(ask: Ask, progress: (t: string) => void = () => {}): Promise<Json> {
  return new Promise((ok, fail) => {
    const s = seq++;
    waiting.set(s, { progress, ok, fail });
    const env: Envelope = { seq: s, ask };
    connect().postMessage(env);
  });
}

export function call(tool: string, args: { [k: string]: Json }, progress?: (t: string) => void): Promise<Json> {
  if (__WEB__) {
    return webCall(tool, args, progress ?? (() => {})).then((r) => {
      if (r.ok) return r.result;
      throw new HubError(r.error);
    });
  }
  return send({ kind: "call", tool, args }, progress);
}

export interface Pointer {
  key: string | null;
  changed: string | null;
  source: string;
}

export async function pointer(owner: string, repo: string): Promise<Pointer> {
  return (await send({ kind: "pointer", owner, repo })) as unknown as Pointer;
}

export async function open(page: "repo" | "thread" | "compose" | "inbox", params: { [k: string]: string }): Promise<void> {
  // On the web the form opens in this tab and comes back when it is done: the
  // whole origin is the hub's own, so there is no other page to sit over.
  if (__WEB__) { location.href = `${page}.html?${new URLSearchParams(params)}`; return; }
  await send({ kind: "open", page, params });
}

/** Start the host afresh on the next call: after an upgrade, the old one is still running. */
export async function restartHost(): Promise<void> {
  if (__WEB__) return;
  await send({ kind: "restart" });
}

/** Tell the GitHub tab a form came from that the repository changed. */
export async function changed(tab: number | null, key: string): Promise<void> {
  if (__WEB__) return;
  await send({ kind: "changed", tab, key });
}

/** Whether this frontend may write at all: a public server offers no tool that does. */
export async function canWrite(): Promise<boolean> {
  if (!__WEB__) return true;
  return serverHello().then((h) => !h.read_only, () => false);
}

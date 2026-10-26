// Asking the background worker, from a content script or an extension page.
//
// The same interface the standalone frontend will implement over HTTP
// (`hub serve`, PEP-24): a call names a tool and its arguments and gets back a
// document or a refusal, with progress on the way.
import type { Answer, Ask, Envelope, HostError, Json } from "./protocol.ts";

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

export async function open(page: "repo" | "thread", params: { [k: string]: string }): Promise<void> {
  await send({ kind: "open", page, params });
}

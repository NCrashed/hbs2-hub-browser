// The web build's side of client.ts: `hbs2-hub serve` over HTTP (PEP-25).
//
// The token a local server printed arrives in the address's fragment, which no
// request carries and no Referer leaks; it is moved into session storage, and
// out of the address, on the first page this tab opens. A public server needs
// none.
import type { HostError, Json } from "./protocol.ts";

const KEY = "hbs2-hub-token";

function stored(): string {
  try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

/** Take the token out of the address, once. */
export function takeToken(): void {
  const m = /(?:^#|&)token=([0-9a-f]{16,128})(?:&|$)/.exec(location.hash);
  if (!m || !m[1]) return;
  try { sessionStorage.setItem(KEY, m[1]); } catch { /* a private window: this page only */ }
  history.replaceState(history.state, "", location.pathname + location.search);
  tokenHere = m[1];
}
let tokenHere = "";
const token = () => tokenHere || stored();

export interface Hello {
  mode: "local" | "public";
  read_only: boolean;
  version: string;
  repos: string[];
}

let hello: Promise<Hello> | null = null;
export function serverHello(): Promise<Hello> {
  hello ??= fetch("/api/hello", { headers: { "X-Hub-Token": token() } }).then(async (r) => {
    if (r.status === 401) throw new Error("This page needs the address `hbs2-hub serve` printed, with its token. Open that one.");
    if (!r.ok) throw new Error(`the server answered ${r.status}`);
    return (await r.json()) as Hello;
  });
  return hello;
}

/** One call: progress lines, then the result or a refusal, one JSON object a line. */
export async function webCall(tool: string, args: { [k: string]: Json }, progress: (t: string) => void): Promise<{ ok: true; result: Json } | { ok: false; error: HostError }> {
  let r: Response;
  try {
    r = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Token": token() },
      body: JSON.stringify({ tool, args }),
    });
  } catch (e) {
    return { ok: false, error: { code: null, meaning: "no-server", message: `hbs2-hub serve is not answering: ${String(e)}` } };
  }
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    let error: HostError = { code: null, meaning: `http-${r.status}`, message: text || `the server answered ${r.status}` };
    try { const j = JSON.parse(text) as { error?: HostError }; if (j.error) error = j.error; } catch { /* not JSON */ }
    if (r.status === 401) error = { ...error, message: "This page needs the address `hbs2-hub serve` printed, with its token. Open that one." };
    return { ok: false, error };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const m = JSON.parse(line) as { progress?: string; ok?: boolean; result?: Json; error?: HostError };
      if (typeof m.progress === "string") progress(m.progress);
      else if (m.ok === true) return { ok: true, result: m.result ?? null };
      else if (m.ok === false && m.error) return { ok: false, error: m.error };
    }
    if (done) break;
  }
  return { ok: false, error: { code: null, meaning: "cut-short", message: "the answer ended before its result" } };
}

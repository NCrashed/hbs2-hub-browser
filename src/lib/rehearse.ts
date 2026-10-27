// A write done on an extension page itself (the inbox, the maintainers): its
// dry run shown in place, then the button that signs, then publish when it
// wrote canon. The pages' version of the window's review.
import { HubError, call, restartHost } from "./client.ts";
import { textOf } from "./compose.ts";
import type { Json } from "./protocol.ts";
import { el } from "./dom.ts";

/** A refusal as the person should read it, with the way out of an old host. */
export function refusal(e: unknown): HTMLElement {
  const m = e instanceof Error ? e.message : String(e);
  if (/unknown argument\(s\)/.test(m) || (e instanceof HubError && e.error.meaning === "unknown-tool")) {
    const again = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Restart the host and try again");
    again.addEventListener("click", () => { void restartHost().then(() => location.reload()); });
    return el("div", { class: "hbs2-flash is-error" },
      el("p", {}, "The hbs2-hub answering here is older than this extension; update it to 0.26.0.2 or later."),
      el("div", { class: "hbs2-actions" }, again), el("p", { class: "hbs2-muted" }, m));
  }
  return el("div", { class: "hbs2-flash is-error" }, el("pre", { class: "hbs2-out" }, m));
}

export interface Rehearsal {
  tool: string;
  args: { [k: string]: Json };
  /** Canon is written: publish after, to this repository. */
  publish: string | null;
  sign: string;
  warn: string;
}

/**
 * Rehearse into \`into\`, and resolve with what the write printed once it has
 * been confirmed and done, or null when the person stepped back or it failed.
 */
export function rehearse(into: HTMLElement, r: Rehearsal): Promise<string | null> {
  return new Promise((done) => {
    const status = el("p", { class: "hbs2-muted" }, "Rehearsing");
    into.replaceChildren(status);
    call(r.tool, { ...r.args, dry_run: true }, (p) => { status.textContent = p; }).then((v) => {
      const said = textOf(v);
      const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, r.sign);
      const back = el("button", { type: "button", class: "hbs2-btn" }, "Not now");
      into.replaceChildren(
        el("p", { class: "hbs2-muted" }, "A dry run of exactly this, with nothing signed or sent:"),
        el("pre", { class: "hbs2-out" }, [said.text, said.notes].filter(Boolean).join("\n") || "(no output)"),
        el("p", { class: "hbs2-warn-line" }, r.warn),
        el("div", { class: "hbs2-actions" }, back, go));
      back.addEventListener("click", () => { into.replaceChildren(); done(null); });
      go.addEventListener("click", async () => {
        go.disabled = back.disabled = true;
        const st = el("p", { class: "hbs2-muted" }, "Signing");
        into.append(st);
        try {
          const out = textOf(await call(r.tool, r.args, (p) => { st.textContent = p; }));
          if (r.publish) {
            st.textContent = "Publishing canon";
            await call("publish", { repo: r.publish }, (p) => { st.textContent = p; });
          }
          done(out.text);
        } catch (e) {
          st.replaceChildren(el("strong", {}, "It did not go through."));
          into.append(refusal(e));
          go.disabled = back.disabled = false;
        }
      });
    }, (e) => { into.replaceChildren(refusal(e)); done(null); });
  });
}

export const CANON_WARN = "Canon is append-only: once published this is public and permanent in every clone.";

// A Markdown editor with GitHub's Write and Preview tabs.
//
// The same one under a thread on GitHub and in the extension's form. The
// preview is the extension's own reader (markdown.ts, built with DOM calls),
// so what is previewed is what the thread view will draw.
import { el, markdownEl } from "./dom.ts";

export interface Editor {
  node: HTMLElement;
  value: () => string;
  focus: () => void;
}

export function editor(o: {
  initial?: string;
  placeholder: string;
  rows?: number;
  /** Put beside "Markdown is supported", at the right: the button that sends. */
  action?: HTMLElement;
  /** Ctrl+Enter or Cmd+Enter, as on GitHub. */
  submit?: () => void;
}): Editor {
  const area = el("textarea", { class: "hbs2-input hbs2-area", placeholder: o.placeholder, rows: String(o.rows ?? 10) },
    o.initial ?? "");
  const preview = el("div", { class: "hbs2-md hbs2-preview" });
  preview.hidden = true;
  const write = el("button", { type: "button", class: "hbs2-etab is-selected" }, "Write");
  const show = el("button", { type: "button", class: "hbs2-etab" }, "Preview");
  const pick = (p: boolean) => {
    area.hidden = p;
    preview.hidden = !p;
    write.classList.toggle("is-selected", !p);
    show.classList.toggle("is-selected", p);
    if (p) preview.replaceChildren(area.value.trim() ? markdownEl(area.value) : el("p", { class: "hbs2-muted" }, "Nothing to preview"));
    else area.focus();
  };
  write.addEventListener("click", () => pick(false));
  show.addEventListener("click", () => pick(true));
  if (o.submit) {
    const submit = o.submit;
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    });
  }
  return {
    node: el("div", { class: "hbs2-editor" },
      el("div", { class: "hbs2-etabs" }, write, show),
      area, preview,
      el("div", { class: "hbs2-efoot" },
        el("span", { class: "hbs2-hint hbs2-muted" }, "Markdown is supported."),
        o.action ?? null)),
    value: () => area.value,
    focus: () => area.focus(),
  };
}

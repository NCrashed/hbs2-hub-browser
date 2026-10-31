// The web build's home page (PEP-25): the repositories this server shows.
// A public server shows the ones its operator named; a local one, the working
// clones the user named with `git config hbs2-hub.<key>.clone`, and any other
// key typed in.
import { siteBar } from "../lib/bar.ts";
import { el, shortKey } from "../lib/dom.ts";
import { identiconEl } from "../lib/identicon.ts";
import { isRepoKey } from "../lib/pointer.ts";
import { serverHello } from "../lib/web.ts";
import { call } from "../lib/client.ts";
import { aboutOf } from "../lib/repohead.ts";
import { recent } from "../lib/recent.ts";
import { operatorStatusOf, sizeText, type OperatorLease, type OperatorStatus } from "../lib/operator.ts";

siteBar(null, ".");
const main = document.querySelector("main")!;

function repoLink(key: string): string {
  return `./pages/code.html?${new URLSearchParams({ key })}`;
}

// A repository's line: its key at once, its name and description as soon as
// its manifest answers (the code view's refs), and the key alone if it never does.
function item(k: string): HTMLElement {
  const name = el("a", { href: repoLink(k), title: k }, shortKey(k));
  const desc = el("div", { class: "hbs2-muted hbs2-small" });
  const line = el("div", { class: "hbs2-home-item" }, identiconEl(k, 32),
    el("div", { class: "hbs2-home-text" }, name, desc,
      el("div", { class: "hbs2-muted hbs2-small" }, el("code", {}, `hbs23://${k}`))));
  void call("code_refs", { repo: k }).then((v) => {
    const a = aboutOf(v);
    if (a.name) name.replaceChildren(el("bdi", {}, a.name));
    if (a.description) desc.replaceChildren(el("bdi", {}, a.description));
  }, () => {});
  return line;
}

function leaseItem(lease: OperatorLease): HTMLElement {
  const details = lease.snapshot
    ? `${sizeText(lease.snapshot.bytes)} complete; ${lease.snapshot.blocks} blocks`
    : `${sizeText(lease.maxBytes)} reserved; no complete snapshot`;
  return el("div", { class: "hbs2-lease-item" },
    el("div", { class: `hbs2-lease-state is-${lease.state}` }, lease.state),
    el("div", { class: "hbs2-home-text" },
      el("a", { href: repoLink(lease.repository), title: lease.repository }, shortKey(lease.repository)),
      el("div", { class: "hbs2-muted hbs2-small" }, details),
      lease.error ? el("div", { class: "hbs2-small hbs2-danger" }, lease.error) : null));
}

function operatorPanel(status: OperatorStatus): HTMLElement {
  const capacity = status.capacity;
  const capacityBody = capacity
    ? el("div", { class: "hbs2-capacity" },
        el("div", {}, el("b", {}, sizeText(capacity.budgetBytes)), el("span", { class: "hbs2-muted" }, " donated")),
        el("progress", { max: String(capacity.budgetBytes || 1), value: String(capacity.reservedBytes) }),
        el("div", { class: "hbs2-muted hbs2-small" },
          `${sizeText(capacity.reservedBytes)} reserved; ${sizeText(capacity.availableBytes)} available; ${capacity.contracts}/${capacity.maxContracts} contracts`))
    : el("div", { class: "hbs2-flash is-error" }, status.capacityError ?? "The local peer did not report donated capacity.");
  const leases = status.leases === null
    ? el("div", { class: "hbs2-flash is-error" }, status.leasesError ?? "The local peer did not report its leases.")
    : status.leases.length
      ? el("div", { class: "hbs2-lease-list" }, ...status.leases.map(leaseItem))
      : el("p", { class: "hbs2-muted" }, "No repository leases are using this node.");
  const config = status.configuration;
  return el("section", { class: "hbs2-operator" },
    el("h2", {}, "Donated repository storage"), capacityBody,
    config ? el("p", { class: "hbs2-muted hbs2-small" }, "Configure with ",
      el("code", {}, config.budgetKey), " and ", el("code", {}, config.contractsKey), "; ", config.apply, ".") : null,
    el("h2", {}, "Repository leases"), leases);
}

async function load(): Promise<void> {
  let hello;
  try {
    hello = await serverHello();
  } catch (e) {
    main.replaceChildren(el("div", { class: "hbs2-flash is-error" }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const local = hello.mode === "local";
  const items = hello.repos.map(item);
  const lately = local ? recent().filter((k) => !hello.repos.includes(k)) : [];
  const parts: HTMLElement[] = [
    el("h1", {}, local ? "Your repositories" : "Repositories"),
    items.length ? el("div", { class: "hbs2-home-list" }, ...items)
      : el("p", { class: "hbs2-muted" }, local
          ? "No working clone is named yet: `git config --global hbs2-hub.<key>.clone <dir>` names one. Any repository can be opened below."
          : "This server shows no repository."),
  ];
  if (lately.length) parts.push(el("h2", {}, "Recently viewed"), el("div", { class: "hbs2-home-list" }, ...lately.map(item)));
  if (local) {
    const operator = el("section", {}, el("h2", {}, "Donated repository storage"), el("p", { class: "hbs2-muted" }, "Reading local peer capacity..."));
    parts.push(operator);
    void call("lease_status", {}).then((value) => operator.replaceWith(operatorPanel(operatorStatusOf(value))), (error) => {
      operator.replaceChildren(el("h2", {}, "Donated repository storage"),
        el("div", { class: "hbs2-flash is-error" }, error instanceof Error ? error.message : String(error)));
    });
    const input = el("input", { class: "hbs2-input", placeholder: "hbs23://<repository key>, or the key" });
    const go = el("button", { type: "button", class: "hbs2-btn is-primary" }, "Open");
    const err = el("div", {});
    const open = () => {
      const k = input.value.trim().replace(/^hbs23:\/\//, "");
      if (!isRepoKey(k)) { err.replaceChildren(el("div", { class: "hbs2-flash is-error" }, "That is not a repository key.")); return; }
      location.href = repoLink(k);
    };
    go.addEventListener("click", open);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    parts.push(el("h2", {}, "Open a repository"), el("div", { class: "hbs2-open" }, input, go), err);
  }
  main.replaceChildren(...parts);
}

void load();

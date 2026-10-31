import type { Json } from "./protocol.ts";

export interface RepoCounts { issues?: number; pulls?: number; inbox?: number }

export type Replication =
  | { kind: "ready"; minimum: number; target: number | null; provider: string;
      snapshot: string; expiresAt: number | null; observedAvailability: number | null }
  | { kind: "at-risk"; target: number | null }
  | { kind: "unknown"; reason: string | null };

const objectOf = (value: Json | undefined): { [key: string]: Json } | null =>
  Object.prototype.toString.call(value) === "[object Object]"
    ? value as { [key: string]: Json }
    : null;

const natural = (value: Json | undefined): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

function readyReplication(replication: { [key: string]: Json }, target: number | null): Replication | null {
  if (replication["at_risk"] !== false) return null;
  const minimum = natural(replication["complete_replicas_minimum"]);
  if (minimum === null || minimum === 0) return null;
  const provider = replication["provider"];
  const snapshot = replication["snapshot"];
  if (typeof provider !== "string" || typeof snapshot !== "string") return null;
  const freshness = objectOf(replication["freshness"]);
  const observed = replication["observed_availability"];
  return {
    kind: "ready", minimum, target, provider, snapshot,
    expiresAt: natural(freshness?.["expires_at"]),
    observedAvailability: typeof observed === "number" ? observed : null,
  };
}

/** Read only what the status contract proves.  A minimum is deliberately not
 * renamed to a total: bounded discovery returns one selected provider. */
export function replicationOf(status: Json): Replication {
  const replication = objectOf(objectOf(status)?.["replication"]);
  if (!replication) return { kind: "unknown", reason: null };
  const target = natural(replication["target"]);
  if (replication["at_risk"] === true) return { kind: "at-risk", target };
  const ready = readyReplication(replication, target);
  if (ready) return ready;
  const error = replication["error"];
  return { kind: "unknown", reason: typeof error === "string" ? error : null };
}

export function replicationText(replication: Replication): string {
  if (replication.kind === "at-risk") return "Replication at risk";
  if (replication.kind === "unknown") return "Replication unknown";
  const floor = `${replication.minimum}+ replica${replication.minimum === 1 ? "" : "s"}`;
  return replication.target === null ? floor : `${floor} / target ${replication.target}`;
}

/** Add the mailbox fact status already returned, without inventing a zero when
 * an older host could not say. */
export function countsWithInbox(counts: RepoCounts, waiting: number | null): RepoCounts {
  return waiting === null ? counts : { ...counts, inbox: waiting };
}

export type SyncCall = (
  tool: string,
  args: { [k: string]: Json },
  progress?: (text: string) => void,
) => Promise<Json>;

/** The local UI's refresh operation. Reload only after sync completed, so a
 * refusal stays visible on the page and a success cannot leave stale lists. */
export async function syncRepository(
  repo: string,
  run: SyncCall,
  reload: () => void,
  progress: (text: string) => void = () => {},
): Promise<void> {
  await run("sync", { repo }, progress);
  reload();
}

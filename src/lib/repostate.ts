import type { Json } from "./protocol.ts";

export interface RepoCounts { issues?: number; pulls?: number; inbox?: number }

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

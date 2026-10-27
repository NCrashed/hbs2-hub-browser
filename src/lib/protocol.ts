// What the extension and `hbs2-hub native-host` say to each other (PEP-24).

export const HOST_NAME = "app.hbs2.hub";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface HostError {
  /** The CLI's exit code, when a verb ran and refused. */
  code: number | null;
  /** A short name: the exit code's meaning, or the host's own (`no-clone`, `unknown-tool`, ...). */
  meaning: string;
  message: string;
}

export type HostReply =
  | { id: number; ok: true; result: Json }
  | { id: number; ok: false; error: HostError }
  | { id: number; progress: string };

export interface ToolInfo {
  name: string;
  title: string;
  readOnly: boolean;
}

/** A tool row from the host's `tools` answer, as the `hub mcp` table writes it. */
export function toolInfo(t: Json): ToolInfo | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const name = t["name"];
  const title = t["title"];
  const ann = t["annotations"];
  if (typeof name !== "string") return null;
  const ro = ann && typeof ann === "object" && !Array.isArray(ann) ? ann["readOnlyHint"] : undefined;
  return { name, title: typeof title === "string" ? title : name, readOnly: ro === true };
}

// Between the extension's own parts.

/** A request from a content script or an extension page to the background worker. */
export type Ask =
  | { kind: "call"; tool: string; args: { [k: string]: Json } }
  | { kind: "pointer"; owner: string; repo: string }
  | { kind: "open"; page: "repo" | "thread" | "compose" | "inbox"; params: { [k: string]: string } }
  /** A write finished: the GitHub tab the form was opened from redraws. */
  | { kind: "changed"; tab: number | null; key: string }
  /** Close the connection to the host, so the next call starts the one installed now. */
  | { kind: "restart" };

/** What the background worker tells a GitHub tab. */
export interface TabNote {
  kind: "hbs2-changed";
  key: string;
}

export type Answer =
  | { kind: "result"; seq: number; ok: true; result: Json }
  | { kind: "result"; seq: number; ok: false; error: HostError }
  | { kind: "progress"; seq: number; text: string };

export interface Envelope {
  seq: number;
  ask: Ask;
}

/**
 * Whether a caller may run a tool.
 *
 * THE CONTENT SCRIPT READS AND NOTHING ELSE. It runs on a GitHub page an
 * attacker can write to (an issue title, a README), so a write may come only
 * from the extension's own pages, after the user has confirmed it there. A tool
 * the host did not describe is treated as a write.
 */
export function mayCall(from: "content" | "page", tool: string, table: Map<string, ToolInfo>): boolean {
  if (from === "page") return table.has(tool);
  return table.get(tool)?.readOnly === true;
}

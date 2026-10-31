import type { Json } from "./protocol.ts";

export interface OperatorCapacity {
  budgetBytes: number;
  reservedBytes: number;
  availableBytes: number;
  contracts: number;
  maxContracts: number;
}

export interface OperatorLease {
  id: string;
  repository: string;
  state: "syncing" | "active" | "degraded" | "grace" | "terminated";
  maxBytes: number;
  maxBlocks: number;
  maxUpdateLag: number;
  grace: number;
  expiresAt: number | null;
  snapshot: { id: string; bytes: number; blocks: number; completedAt: number } | null;
  error: string | null;
}

export interface OperatorStatus {
  capacity: OperatorCapacity | null;
  capacityError: string | null;
  leases: OperatorLease[] | null;
  leasesError: string | null;
  configuration: { budgetKey: string; contractsKey: string; apply: string } | null;
}

const objectOf = (value: Json | undefined): { [key: string]: Json } | null =>
  Object.prototype.toString.call(value) === "[object Object]"
    ? value as { [key: string]: Json }
    : null;

const natural = (value: Json | undefined): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const text = (value: Json | undefined): string | null => typeof value === "string" ? value : null;

function textFields(record: { [key: string]: Json }, names: string[]): string[] | null {
  const values = names.map((name) => text(record[name]));
  return values.every((value): value is string => value !== null) ? values : null;
}

function naturalFields(record: { [key: string]: Json }, names: string[]): number[] | null {
  const values = names.map((name) => natural(record[name]));
  return values.every((value): value is number => value !== null) ? values : null;
}

function capacityOf(value: Json | undefined): OperatorCapacity | null {
  const capacity = objectOf(value);
  if (!capacity) return null;
  const values = naturalFields(capacity, ["budget_bytes", "reserved_bytes", "available_bytes", "contracts", "max_contracts"]);
  if (!values) return null;
  const [budgetBytes, reservedBytes, availableBytes, contracts, maxContracts] = values;
  return { budgetBytes: budgetBytes!, reservedBytes: reservedBytes!, availableBytes: availableBytes!, contracts: contracts!, maxContracts: maxContracts! };
}

const leaseStates = new Set<OperatorLease["state"]>(["syncing", "active", "degraded", "grace", "terminated"]);

function leaseState(value: Json | undefined): OperatorLease["state"] | null {
  return typeof value === "string" && leaseStates.has(value as OperatorLease["state"])
    ? value as OperatorLease["state"]
    : null;
}

function snapshotOf(value: Json | undefined): OperatorLease["snapshot"] | undefined {
  if (value === null) return null;
  const snapshot = objectOf(value);
  if (!snapshot) return undefined;
  const ids = textFields(snapshot, ["id"]);
  const values = naturalFields(snapshot, ["bytes", "blocks", "completed_at"]);
  if (!ids || !values) return undefined;
  return { id: ids[0]!, bytes: values[0]!, blocks: values[1]!, completedAt: values[2]! };
}

function nullableNatural(value: Json | undefined): number | null | undefined {
  if (value === null) return null;
  const parsed = natural(value);
  return parsed === null ? undefined : parsed;
}

function leaseOf(value: Json): OperatorLease | null {
  const lease = objectOf(value);
  if (!lease) return null;
  const names = textFields(lease, ["id", "repository"]);
  if (!names) return null;
  const state = leaseState(lease["state"]);
  if (!state) return null;
  const limits = naturalFields(lease, ["max_bytes", "max_blocks", "max_update_lag", "grace"]);
  if (!limits) return null;
  const snapshot = snapshotOf(lease["snapshot"]);
  if (snapshot === undefined) return null;
  const expiresAt = nullableNatural(lease["expires_at"]);
  if (expiresAt === undefined) return null;
  const problem = lease["error"];
  return {
    id: names[0]!, repository: names[1]!, state,
    maxBytes: limits[0]!, maxBlocks: limits[1]!, maxUpdateLag: limits[2]!, grace: limits[3]!,
    expiresAt, snapshot,
    error: typeof problem === "string" ? problem : null,
  };
}

function leasesOf(value: Json | undefined, reportedError: string | null): Pick<OperatorStatus, "leases" | "leasesError"> {
  if (!Array.isArray(value)) return { leases: null, leasesError: reportedError };
  const leases = value.map(leaseOf);
  if (!leases.every((lease): lease is OperatorLease => lease !== null))
    return { leases: null, leasesError: "invalid lease status document" };
  return { leases, leasesError: reportedError };
}

function configurationOf(value: Json | undefined): OperatorStatus["configuration"] {
  const configuration = objectOf(value);
  if (!configuration) return null;
  const fields = textFields(configuration, ["budget_bytes", "max_contracts", "apply"]);
  return fields ? { budgetKey: fields[0]!, contractsKey: fields[1]!, apply: fields[2]! } : null;
}

export function operatorStatusOf(value: Json): OperatorStatus {
  const status = objectOf(value);
  const capacity = capacityOf(status?.["capacity"]);
  const capacityObject = objectOf(status?.["capacity"]);
  const leaseStatus = leasesOf(status?.["leases"], text(status?.["leases_error"]));
  return {
    capacity,
    capacityError: text(capacityObject?.["error"]),
    ...leaseStatus,
    configuration: configurationOf(status?.["configuration"]),
  };
}

export function sizeText(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}

import assert from "node:assert/strict";
import test from "node:test";
import { operatorStatusOf, sizeText } from "../src/lib/operator.ts";
import type { Json } from "../src/lib/protocol.ts";

const status = {
  configuration: { budget_bytes: "barter-budget-bytes", max_contracts: "barter-max-contracts", apply: "restart hbs2-peer" },
  capacity: { budget_bytes: 10000, reserved_bytes: 1000, available_bytes: 9000, contracts: 1, max_contracts: 64, error: null },
  leases: [{
    id: "lease", repository: "repo", state: "active", max_bytes: 1000,
    max_blocks: 100, max_update_lag: 30, grace: 10, expires_at: null,
    snapshot: { id: "snapshot", bytes: 700, blocks: 7, completed_at: 20 }, error: null,
  }],
  leases_error: null,
};

test("operator status keeps configured, reserved, and available capacity distinct", () => {
  const parsed = operatorStatusOf(status);
  assert.deepEqual(parsed.capacity, { budgetBytes: 10000, reservedBytes: 1000, availableBytes: 9000, contracts: 1, maxContracts: 64 });
  assert.deepEqual(parsed.leases?.[0], {
    id: "lease", repository: "repo", state: "active", maxBytes: 1000,
    maxBlocks: 100, maxUpdateLag: 30, grace: 10, expiresAt: null,
    snapshot: { id: "snapshot", bytes: 700, blocks: 7, completedAt: 20 }, error: null,
  });
  assert.deepEqual(parsed.configuration, { budgetKey: "barter-budget-bytes", contractsKey: "barter-max-contracts", apply: "restart hbs2-peer" });
});

test("operator status never turns a silent peer into zero capacity or leases", () => {
  const parsed = operatorStatusOf({
    capacity: { budget_bytes: null, reserved_bytes: null, available_bytes: null, contracts: null, max_contracts: null, error: "peer silent" },
    leases: null, leases_error: "peer silent",
  });
  assert.equal(parsed.capacity, null);
  assert.equal(parsed.capacityError, "peer silent");
  assert.equal(parsed.leases, null);
  assert.equal(parsed.leasesError, "peer silent");
});

test("one malformed lease invalidates the list instead of disappearing", () => {
  const parsed = operatorStatusOf({ ...status, leases: [{ repository: "repo", state: "active" }] });
  assert.equal(parsed.leases, null);
  assert.equal(parsed.leasesError, "invalid lease status document");
});

test("lease snapshot, state, and expiry boundaries are validated", () => {
  const base = status.leases[0]!;
  assert.equal(operatorStatusOf({ ...status, leases: [{ ...base, snapshot: null, expires_at: 50 }] }).leases?.[0]?.expiresAt, 50);
  assert.equal(operatorStatusOf({ ...status, leases: [{ ...base, error: 42 }] }).leases?.[0]?.error, null);
  const malformed: Json[] = [
    { ...base, snapshot: {} },
    { ...base, snapshot: { id: "snapshot" } },
    { ...base, state: "claimed-active" },
    { ...base, expires_at: "tomorrow" },
    { ...base, max_bytes: -1 },
    { ...base, max_blocks: 1.5 },
  ];
  for (const changed of malformed) {
    const parsed = operatorStatusOf({ ...status, leases: [changed] });
    assert.equal(parsed.leases, null);
    assert.equal(parsed.leasesError, "invalid lease status document");
  }
});

test("zero is a valid natural but negative, fractional, and textual capacity are not", () => {
  const zero = operatorStatusOf({ ...status, capacity: { ...status.capacity, budget_bytes: 0, reserved_bytes: 0, available_bytes: 0, contracts: 0, max_contracts: 0 } });
  assert.deepEqual(zero.capacity, { budgetBytes: 0, reservedBytes: 0, availableBytes: 0, contracts: 0, maxContracts: 0 });
  for (const invalid of [-1, 1.5, "10000"]) {
    assert.equal(operatorStatusOf({ ...status, capacity: { ...status.capacity, budget_bytes: invalid } }).capacity, null);
  }
});

test("a non-object status is entirely unknown", () => {
  assert.deepEqual(operatorStatusOf(null), {
    capacity: null, capacityError: null, leases: null, leasesError: null, configuration: null,
  });
});

test("byte sizes are compact but exact bytes remain available to callers", () => {
  assert.equal(sizeText(0), "0 B");
  assert.equal(sizeText(1023), "1023 B");
  assert.equal(sizeText(1024), "1 KiB");
  assert.equal(sizeText(1536), "1.5 KiB");
  assert.equal(sizeText(10 * 1024 * 1024 * 1024), "10 GiB");
  assert.equal(sizeText(1024 ** 4), "1 TiB");
  assert.equal(sizeText(1024 ** 5), "1024 TiB");
});

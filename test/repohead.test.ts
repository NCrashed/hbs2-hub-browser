import { test } from "node:test";
import assert from "node:assert/strict";
import { countsWithInbox, replicationOf, replicationText } from "../src/lib/repostate.ts";

test("the repository tabs carry the mailbox count status already returned", () => {
  const counts = { issues: 3, pulls: 1 };
  assert.deepEqual(countsWithInbox(counts, 2), { issues: 3, pulls: 1, inbox: 2 });
  assert.deepEqual(countsWithInbox(counts, 0), { issues: 3, pulls: 1, inbox: 0 });
  assert.deepEqual(countsWithInbox(counts, null), counts);
});

test("replication keeps a proved floor distinct from a network total", () => {
  const ready = replicationOf({ replication: {
    target: null,
    complete_replicas_minimum: 1,
    provider: "provider-key",
    snapshot: "snapshot-hash",
    freshness: { issued_at: 1000, expires_at: 2000 },
    reachable_via: ["tcp://127.0.0.1:7351"],
    observed_availability: null,
    at_risk: false,
    error: null,
  } });
  assert.deepEqual(ready, {
    kind: "ready", minimum: 1, target: null, provider: "provider-key",
    snapshot: "snapshot-hash", expiresAt: 2000, observedAvailability: null,
  });
  assert.equal(replicationText(ready), "1+ replica");
});

test("replication says at risk only when lookup completed", () => {
  const atRisk = replicationOf({ replication: {
    complete_replicas_minimum: 0, at_risk: true, error: null,
  } });
  const unknown = replicationOf({ replication: {
    complete_replicas_minimum: null, at_risk: null, error: "peer silent",
  } });
  assert.deepEqual(atRisk, { kind: "at-risk", target: null });
  assert.deepEqual(unknown, { kind: "unknown", reason: "peer silent" });
  assert.equal(replicationText(atRisk), "Replication at risk");
  assert.equal(replicationText(unknown), "Replication unknown");
  assert.deepEqual(replicationOf(null), { kind: "unknown", reason: null });
});

test("replication rejects incomplete and misshapen claims", () => {
  assert.deepEqual(replicationOf([]), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf("status"), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf({ replication: [] }), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf({ replication: "advert" }), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf({ replication: {
    complete_replicas_minimum: 0, provider: "p", snapshot: "s", at_risk: false,
  } }), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf({ replication: {
    complete_replicas_minimum: 1, provider: 7, snapshot: "s", at_risk: false,
    error: 9,
  } }), { kind: "unknown", reason: null });
  assert.deepEqual(replicationOf({ replication: {
    complete_replicas_minimum: 1, provider: "p", snapshot: null, at_risk: false,
  } }), { kind: "unknown", reason: null });
});

test("replication carries future target and availability fields without inventing them", () => {
  const ready = replicationOf({ replication: {
    target: 3, complete_replicas_minimum: 2, provider: "p", snapshot: "s",
    freshness: null, observed_availability: 0.75, at_risk: false,
  } });
  assert.deepEqual(ready, {
    kind: "ready", minimum: 2, target: 3, provider: "p", snapshot: "s",
    expiresAt: null, observedAvailability: 0.75,
  });
  assert.equal(replicationText(ready), "2+ replicas / target 3");
  const atRisk = replicationOf({ replication: { target: 3, at_risk: true } });
  assert.deepEqual(atRisk, { kind: "at-risk", target: 3 });
  assert.deepEqual(replicationOf({ replication: { target: 0, at_risk: true } }),
    { kind: "at-risk", target: 0 });
  for (const target of [-1, 1.5, "3"] as const) {
    assert.deepEqual(replicationOf({ replication: { target, at_risk: true } }),
      { kind: "at-risk", target: null });
  }
});

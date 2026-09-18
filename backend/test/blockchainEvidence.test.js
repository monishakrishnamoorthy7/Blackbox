import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { LocalEvidenceLedger } from "../src/services/blockchain/LocalEvidenceLedger.js";
import { canonicalizeEvidence, createEvidenceSnapshot, hashEvidence } from "../src/services/blockchain/evidenceCanonicalizer.js";

const baseEvidence = {
  evidenceVersion: 1,
  evidenceId: "evidence-test-001",
  deviceId: "BBX-TEST-001",
  timestamp: "2026-09-06T08:00:00Z",
  telemetryId: "telemetry-001",
  severity: "high",
  confidence: 75,
  impact: 18.4,
  speedBeforeImpact: 42,
  speedAfterImpact: 4,
  speedDrop: 38,
  leanAngle: 52,
  acceleration: { z: 14.5, x: 5.8, y: 7.2 },
  gyroscope: { z: 19, x: 38, y: -27 },
  temperature: 36.8,
  current: 2.2,
  gpsStatus: "fix",
  networkStatus: "online",
  triggeredSignals: ["SPEED_DROP", "IMPACT", "ABNORMAL_LEAN"],
  accidentStatus: "accident",
  source: "sensor-verification",
  latitude: 12.97,
  longitude: 77.6,
  personalName: "should-not-be-included",
};

let tempDir;

function createClockLedger(fileName) {
  const clock = { value: new Date("2026-09-01T12:00:00Z") };
  const ledger = new LocalEvidenceLedger(path.join(tempDir, fileName), {
    retentionDays: 7,
    now: () => clock.value,
  });
  return { clock, ledger };
}

async function recordAt(ledger, clock, evidenceId, recordedAt) {
  clock.value = new Date(recordedAt);
  return ledger.record(evidenceId, hashEvidence({ ...baseEvidence, evidenceId, timestamp: recordedAt }), 1);
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "bike-black-box-ledger-"));
});

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("tamper-evident evidence", () => {
  it("produces the same hash for equivalent evidence", () => {
    const reordered = { ...baseEvidence, acceleration: { x: 5.8, y: 7.2, z: 14.5 }, triggeredSignals: [...baseEvidence.triggeredSignals].reverse() };
    assert.equal(hashEvidence(baseEvidence), hashEvidence(reordered));
    assert.equal(hashEvidence(baseEvidence), hashEvidence(createEvidenceSnapshot(baseEvidence)));
  });

  it("changes the hash when evidence changes", () => {
    assert.notEqual(hashEvidence(baseEvidence), hashEvidence({ ...baseEvidence, impact: 19.4 }));
  });

  it("excludes GPS coordinates, personal information, and mutable fields", () => {
    const snapshot = createEvidenceSnapshot({ ...baseEvidence, sosStatus: "SOS_TRIGGERED", cancelledAt: new Date(), message: "private" });
    const canonical = canonicalizeEvidence(snapshot);
    assert.equal(Object.hasOwn(snapshot, "latitude"), false);
    assert.equal(Object.hasOwn(snapshot, "longitude"), false);
    assert.equal(canonical.includes("12.97"), false);
    assert.equal(canonical.includes("should-not-be-included"), false);
    assert.equal(canonical.includes("SOS_TRIGGERED"), false);
    assert.equal(canonical.includes("private"), false);
  });

  it("creates a linked append-only ledger and records idempotently", async () => {
    const ledger = new LocalEvidenceLedger(path.join(tempDir, "evidence.jsonl"));
    const first = await ledger.record(baseEvidence.evidenceId, hashEvidence(baseEvidence), 1);
    const second = await ledger.record(baseEvidence.evidenceId, hashEvidence(baseEvidence), 1);
    const third = await ledger.record("evidence-test-002", hashEvidence({ ...baseEvidence, evidenceId: "evidence-test-002" }), 1);
    const contents = await readFile(path.join(tempDir, "evidence.jsonl"), "utf8");

    assert.deepEqual(second, first);
    assert.equal(contents.trim().split(/\r?\n/).length, 2);
    assert.equal(third.previousHash !== null, true);
    assert.equal((await ledger.verifyChain()).valid, true);
  });

  it("detects a changed accident snapshot during verification", async () => {
    const ledger = new LocalEvidenceLedger(path.join(tempDir, "verify.jsonl"));
    await ledger.record(baseEvidence.evidenceId, hashEvidence(baseEvidence), 1);
    const commitment = await ledger.find(baseEvidence.evidenceId);
    const unchanged = hashEvidence(baseEvidence) === commitment.evidenceHash;
    const tampered = hashEvidence({ ...baseEvidence, confidence: 100 }) === commitment.evidenceHash;
    assert.equal(unchanged, true);
    assert.equal(tampered, false);
  });

  it("handles an empty ledger and retains records younger than seven days", async () => {
    const { clock, ledger } = createClockLedger("retention-young.jsonl");
    assert.deepEqual(await ledger.records(), []);

    await recordAt(ledger, clock, "retention-young-1", "2026-09-01T12:00:00Z");
    await recordAt(ledger, clock, "retention-young-2", "2026-09-02T12:00:00Z");
    clock.value = new Date("2026-09-07T12:00:00Z");

    assert.equal((await ledger.records()).length, 2);
    assert.equal((await ledger.verifyChain()).valid, true);
  });

  it("removes records older than seven days while retaining multiple same-day records", async () => {
    const { clock, ledger } = createClockLedger("retention-old.jsonl");
    await recordAt(ledger, clock, "retention-old", "2026-09-01T11:00:00Z");
    await recordAt(ledger, clock, "same-day-1", "2026-09-03T10:00:00Z");
    await recordAt(ledger, clock, "same-day-2", "2026-09-03T11:00:00Z");
    clock.value = new Date("2026-09-09T12:00:00Z");

    const records = await ledger.records();
    assert.deepEqual(records.map((record) => record.commitmentId), ["same-day-1", "same-day-2"]);
    assert.equal((await ledger.verifyChain()).valid, true);
  });

  it("removes Day 1 on Day 8 and Day 2 on Day 9", async () => {
    const { clock, ledger } = createClockLedger("retention-window.jsonl");
    for (let day = 1; day <= 7; day += 1) {
      await recordAt(ledger, clock, `day-${day}`, `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`);
    }

    await recordAt(ledger, clock, "day-8", "2026-09-08T12:00:00Z");
    assert.deepEqual((await ledger.records()).map((record) => record.commitmentId), [
      "day-2", "day-3", "day-4", "day-5", "day-6", "day-7", "day-8",
    ]);
    assert.equal((await ledger.verifyChain()).valid, true);

    await recordAt(ledger, clock, "day-9", "2026-09-09T12:00:00Z");
    assert.deepEqual((await ledger.records()).map((record) => record.commitmentId), [
      "day-3", "day-4", "day-5", "day-6", "day-7", "day-8", "day-9",
    ]);
    const chain = await ledger.verifyChain();
    assert.equal(chain.valid, true);
    assert.equal(chain.records[0].previousHash, null);
  });

  it("cleans expired records when a new ledger instance loads the file", async () => {
    const fileName = "retention-restart.jsonl";
    const first = createClockLedger(fileName);
    await recordAt(first.ledger, first.clock, "restart-old", "2026-09-01T12:00:00Z");
    await recordAt(first.ledger, first.clock, "restart-new", "2026-09-08T12:00:00Z");

    const restarted = createClockLedger(fileName);
    restarted.clock.value = new Date("2026-09-09T12:00:00Z");
    assert.deepEqual((await restarted.ledger.records()).map((record) => record.commitmentId), ["restart-new"]);
    assert.equal((await restarted.ledger.verifyChain()).valid, true);
  });
});

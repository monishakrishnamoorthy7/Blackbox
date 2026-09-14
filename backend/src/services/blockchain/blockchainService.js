import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../../config/env.js";
import { LocalEvidenceLedger } from "./LocalEvidenceLedger.js";
import { EVIDENCE_VERSION, createEvidenceSnapshot, hashEvidence } from "./evidenceCanonicalizer.js";

const ledgerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../", env.blockchainLedgerPath);
const ledger = new LocalEvidenceLedger(ledgerPath);

export function getEvidenceLedger() {
  return ledger;
}

export function createEvidenceId() {
  return `evidence-${crypto.randomUUID()}`;
}

export function evidenceStatusPayload(accident, status = accident.blockchainStatus || "PENDING") {
  return {
    accidentId: String(accident._id),
    evidenceId: accident.evidenceId,
    status,
    evidenceHash: accident.evidenceHash || null,
    blockchainReference: accident.blockchainReference || null,
    recordedAt: accident.blockchainRecordedAt || null,
  };
}

export async function recordEvidence(accident) {
  if (!env.blockchainEnabled) return { status: "UNAVAILABLE", error: "Blockchain evidence is disabled" };
  if (!accident?.evidenceId) throw new Error("Accident has no evidenceId");
  const snapshot = createEvidenceSnapshot(accident);
  const evidenceHash = hashEvidence(snapshot);
  const commitment = await ledger.record(accident.evidenceId, evidenceHash, EVIDENCE_VERSION);
  return {
    status: "RECORDED",
    evidenceHash,
    blockchainReference: commitment.commitmentId,
    blockchainRecordedAt: commitment.recordedAt,
  };
}

export async function verifyEvidence(accident) {
  if (!env.blockchainEnabled) return { status: "UNAVAILABLE", match: false, error: "Blockchain evidence is disabled" };
  if (!accident?.evidenceId) return { status: "PENDING", match: false, error: "Evidence is not initialized" };
  try {
    const commitment = await ledger.find(accident.evidenceId);
    if (!commitment) return { status: "PENDING", match: false };
    const chain = await ledger.verifyChain();
    const currentHash = hashEvidence(createEvidenceSnapshot(accident));
    const match = chain.valid && currentHash === commitment.evidenceHash;
    return {
      status: match ? "VERIFIED" : "TAMPERED",
      match,
      evidenceHash: currentHash,
      blockchainReference: commitment.commitmentId,
      blockchainRecordedAt: commitment.recordedAt,
    };
  } catch (error) {
    return { status: "UNAVAILABLE", match: false, error: error.message };
  }
}

export async function getBlockchainStatus(pending = 0) {
  if (!env.blockchainEnabled) return { enabled: false, available: false, ledger: "local", pending };
  try {
    const result = await ledger.status();
    return { enabled: true, available: result.available, ledger: "local", pending };
  } catch {
    return { enabled: true, available: false, ledger: "local", pending };
  }
}

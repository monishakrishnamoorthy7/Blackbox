import { logger } from "../../utils/logger.js";
import { getBlockchainStatus, recordEvidence } from "./blockchainService.js";
import { env } from "../../config/env.js";

const pendingEvidence = new Set();

export function pendingEvidenceCount() {
  return pendingEvidence.size;
}

export async function syncAccidentEvidence(accident, updateAccident, io, attempt = 0) {
  const pending = { ...accident, blockchainStatus: "PENDING" };
  pendingEvidence.add(String(accident._id));
  try {
    const result = await recordEvidence(pending);
    const updated = await updateAccident(accident._id, {
      evidenceHash: result.evidenceHash || null,
      blockchainReference: result.blockchainReference || null,
      blockchainRecordedAt: result.blockchainRecordedAt || null,
      blockchainStatus: result.status,
      blockchainError: result.error || null,
    });
    io?.emit("accident:blockchain-status", {
      ...{
        accidentId: String(accident._id),
        evidenceId: accident.evidenceId,
        status: result.status,
        evidenceHash: result.evidenceHash || null,
        blockchainReference: result.blockchainReference || null,
        recordedAt: result.blockchainRecordedAt || null,
      },
    });
    pendingEvidence.delete(String(accident._id));
    return updated || { ...accident, ...result };
  } catch (error) {
    logger.error("Blockchain evidence recording failed", error.message);
    const updated = await updateAccident(accident._id, {
      blockchainStatus: "UNAVAILABLE",
      blockchainError: error.message,
    }).catch((updateError) => {
      logger.error("Blockchain status update failed", updateError.message);
      return null;
    });
    io?.emit("accident:blockchain-status", {
      accidentId: String(accident._id),
      evidenceId: accident.evidenceId,
      status: "UNAVAILABLE",
      evidenceHash: null,
      blockchainReference: null,
      recordedAt: null,
    });
    if (env.blockchainRetryEnabled && attempt < env.blockchainMaxRetries) {
      const delay = env.blockchainRetryIntervalMs * Math.max(1, attempt + 1);
      setTimeout(() => {
        void syncAccidentEvidence(accident, updateAccident, io, attempt + 1);
      }, delay).unref?.();
    } else {
      pendingEvidence.delete(String(accident._id));
    }
    return updated;
  }
}

export async function blockchainStatus(pending = 0) {
  return getBlockchainStatus(Math.max(pending, pendingEvidence.size));
}

export async function retryPendingEvidence(accidents, updateAccident, io) {
  if (!env.blockchainRetryEnabled || !Array.isArray(accidents)) return;
  for (const accident of accidents) {
    if (["PENDING", "UNAVAILABLE"].includes(accident.blockchainStatus)) {
      void syncAccidentEvidence(accident, updateAccident, io);
    }
  }
}

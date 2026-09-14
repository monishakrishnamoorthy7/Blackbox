import { getAccidentAlert, updateAccidentMetadata } from "../services/accidentService.js";
import { evidenceStatusPayload, verifyEvidence } from "../services/blockchain/blockchainService.js";
import { blockchainStatus } from "../services/blockchain/blockchainSyncService.js";

export async function getAccidentBlockchain(req, res, next) {
  try {
    const accident = await getAccidentAlert(req.params.id);
    if (!accident) return res.status(404).json({ ok: false, error: "Accident not found" });
    res.json({ ok: true, data: { ...evidenceStatusPayload(accident), algorithm: "SHA-256" } });
  } catch (error) {
    next(error);
  }
}

export async function verifyAccidentBlockchain(req, res, next) {
  try {
    const accident = await getAccidentAlert(req.params.id);
    if (!accident) return res.status(404).json({ ok: false, error: "Accident not found" });
    const result = await verifyEvidence(accident);
    const updated = await updateAccidentMetadata(accident._id, {
      blockchainStatus: result.status,
      blockchainVerifiedAt: new Date(),
      blockchainError: result.error || null,
    });
    req.app.get("io")?.emit("accident:blockchain-status", {
      ...evidenceStatusPayload(updated || { ...accident, ...result }, result.status),
    });
    res.json({
      ok: true,
      data: {
        status: result.status,
        match: Boolean(result.match),
        evidenceHash: result.evidenceHash || null,
        evidenceId: accident.evidenceId,
        blockchainReference: result.blockchainReference || accident.blockchainReference || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBlockchainServiceStatus(_req, res, next) {
  try {
    res.json({ ok: true, data: await blockchainStatus() });
  } catch (error) {
    next(error);
  }
}

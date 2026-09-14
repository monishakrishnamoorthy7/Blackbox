import { createHash } from "node:crypto";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { EvidenceLedger } from "./EvidenceLedger.js";

function ledgerHash(record) {
  return createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex");
}

export class LocalEvidenceLedger extends EvidenceLedger {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async records() {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async record(evidenceId, evidenceHash, evidenceVersion = 1) {
    const operation = this.writeQueue.then(async () => {
      const records = await this.records();
      const existing = records.find((record) => record.commitmentId === evidenceId);
      if (existing) {
        if (existing.evidenceHash !== evidenceHash) throw new Error("Evidence ID already has a different hash");
        return existing;
      }

      const previous = records.at(-1);
      const record = {
        ledgerVersion: 1,
        commitmentId: evidenceId,
        evidenceHash,
        algorithm: "SHA-256",
        evidenceVersion,
        previousHash: previous ? ledgerHash(previous) : null,
        recordedAt: new Date().toISOString(),
      };
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
      return record;
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async find(evidenceId) {
    return (await this.records()).find((record) => record.commitmentId === evidenceId) || null;
  }

  async verifyChain() {
    const records = await this.records();
    let previousHash = null;
    for (const record of records) {
      if (record.previousHash !== previousHash) return { valid: false, records };
      previousHash = ledgerHash(record);
    }
    return { valid: true, records };
  }

  async status() {
    const records = await this.records();
    return { available: true, count: records.length };
  }
}

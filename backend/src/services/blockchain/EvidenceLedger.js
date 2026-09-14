export class EvidenceLedger {
  async record(_evidenceId, _evidenceHash, _evidenceVersion) {
    throw new Error("EvidenceLedger.record() must be implemented");
  }

  async find(_evidenceId) {
    throw new Error("EvidenceLedger.find() must be implemented");
  }

  async verifyChain() {
    throw new Error("EvidenceLedger.verifyChain() must be implemented");
  }
}

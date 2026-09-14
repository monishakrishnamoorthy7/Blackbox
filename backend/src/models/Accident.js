import mongoose from "mongoose";

const accidentSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now },
    telemetryId: { type: mongoose.Schema.Types.ObjectId, ref: "Telemetry", default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    speed: { type: Number, default: 0 },
    speedBeforeImpact: { type: Number, default: 0 },
    speedAfterImpact: { type: Number, default: 0 },
    speedBefore: { type: Number, default: 0 },
    speedAfter: { type: Number, default: 0 },
    impact: { type: Number, default: 0 },
    leanAngle: { type: Number, default: 0 },
    gpsStatus: { type: String, default: "nofix" },
    temperature: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    vibration: { type: Boolean, default: false },
    accidentStatus: { type: String, default: "accident" },
    state: { type: String, enum: ["NORMAL", "SUSPECTED", "COUNTDOWN", "CANCELLED", "CONFIRMED", "SOS_TRIGGERED"], default: "CONFIRMED" },
    confidence: { type: Number, default: 0 },
    speedDrop: { type: Number, default: 0 },
    acceleration: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    gyroscope: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    triggeredSignals: { type: [String], default: [] },
    networkStatus: { type: String, default: "unknown" },
    sosStatus: { type: String, default: "PENDING" },
    cancelledAt: { type: Date, default: null },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "high" },
    status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open" },
    source: { type: String, default: "simulator" },
    message: { type: String, default: "Accident alert" },
    evidenceId: { type: String, index: true },
    evidenceVersion: { type: Number, default: 1 },
    evidenceHash: { type: String, default: null },
    blockchainStatus: { type: String, enum: ["PENDING", "RECORDED", "VERIFIED", "TAMPERED", "UNAVAILABLE"], default: "PENDING", index: true },
    blockchainReference: { type: String, default: null },
    blockchainRecordedAt: { type: Date, default: null },
    blockchainVerifiedAt: { type: Date, default: null },
    blockchainError: { type: String, default: null },
  },
  { timestamps: true }
);

accidentSchema.index({ deviceId: 1, timestamp: -1 });

export const Accident = mongoose.model("Accident", accidentSchema);

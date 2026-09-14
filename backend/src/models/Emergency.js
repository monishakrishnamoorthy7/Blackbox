import mongoose from "mongoose";

const emergencySchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    type: { type: String, enum: ["ACCIDENT", "MANUAL_SOS"], required: true },
    state: { type: String, enum: ["CANCELLED", "SOS_TRIGGERED"], required: true },
    accidentId: { type: mongoose.Schema.Types.Mixed, default: null },
    severity: { type: String, default: "high" },
    confidence: { type: Number, default: 0 },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    gpsStatus: { type: String, default: "nofix" },
    speed: { type: Number, default: 0 },
    speedBefore: { type: Number, default: 0 },
    speedAfter: { type: Number, default: 0 },
    speedDrop: { type: Number, default: 0 },
    impact: { type: Number, default: 0 },
    leanAngle: { type: Number, default: 0 },
    temperature: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    triggeredSignals: { type: [String], default: [] },
    acceleration: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    gyroscope: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    networkStatus: { type: String, default: "unknown" },
    cancelledAt: { type: Date, default: null },
    smsSimulation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Emergency = mongoose.model("Emergency", emergencySchema);
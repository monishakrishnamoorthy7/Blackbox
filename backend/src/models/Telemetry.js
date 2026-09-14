import mongoose from "mongoose";

const vector3Schema = new mongoose.Schema(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
  },
  { _id: false }
);

const gpsSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    speed: { type: Number, default: 0 },
    course: { type: Number, default: 0 },
    status: { type: String, default: "nofix" },
  },
  { _id: false }
);

const telemetrySchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    speed: { type: Number, default: 0 },
    acceleration: { type: vector3Schema, default: () => ({}) },
    gyroscope: { type: vector3Schema, default: () => ({}) },
    leanAngle: { type: Number, default: 0 },
    temperature: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    vibration: { type: Boolean, default: false },
    gps: { type: gpsSchema, default: () => ({}) },
    networkStatus: { type: String, default: "unknown" },
    accidentStatus: {
      type: String,
      enum: ["normal", "warning", "accident"],
      default: "normal",
      index: true,
    },
  },
  { timestamps: true }
);

telemetrySchema.index({ deviceId: 1, timestamp: -1 });

export const Telemetry = mongoose.model("Telemetry", telemetrySchema);

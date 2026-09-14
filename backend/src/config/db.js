import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDatabase() {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected (${mongoose.connection.name})`);
    return true;
  } catch (error) {
    logger.error(
      "MongoDB connection failed. API will still start; telemetry writes will error until MongoDB is available.",
      error.message
    );
    mongoose.connection.on("connected", () => {
      logger.info(`MongoDB connected (${mongoose.connection.name})`);
    });
    return false;
  }
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

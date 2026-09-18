import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const blockchainLedgerPath =
  process.env.BLOCKCHAIN_LEDGER_PATH || "./data/evidence-ledger.jsonl";

const blockchainLedgerRetentionDays =
  Number(process.env.BLOCKCHAIN_LEDGER_RETENTION_DAYS) || 7;

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/bike_black_box",
  corsOrigin,
  corsOrigins: corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV || "development",
  blockchainEnabled: process.env.BLOCKCHAIN_ENABLED !== "false",
  blockchainLedgerPath,
  blockchainLedgerRetentionDays,
  blockchainRetryEnabled:
    process.env.BLOCKCHAIN_RETRY_ENABLED !== "false",
  blockchainMaxRetries:
    Number(process.env.BLOCKCHAIN_MAX_RETRIES) || 5,
  blockchainRetryIntervalMs:
    Number(process.env.BLOCKCHAIN_RETRY_INTERVAL_MS) || 5000,
  vibrationSensorPin: process.env.VIBRATION_SENSOR_PIN || "",
};
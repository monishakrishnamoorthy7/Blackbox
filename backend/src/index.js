import { env } from "./config/env.js";
import { connectDatabase, isDatabaseReady } from "./config/db.js";
import { logger } from "./utils/logger.js";
import { createApp } from "./app.js";
import { listAccidentAlerts, updateAccidentMetadata } from "./services/accidentService.js";
import { retryPendingEvidence } from "./services/blockchain/blockchainSyncService.js";

const { server, io } = createApp();

async function start() {
  server.listen(env.port, () => {
    logger.info(`Backend listening on http://localhost:${env.port}`);
    logger.info(`CORS origins: ${env.corsOrigins.join(", ")}`);
  });
  await connectDatabase();
  logger.info(`Database: ${isDatabaseReady() ? "connected" : "disconnected"}`);
  try {
    const accidents = await listAccidentAlerts({ limit: 200 });
    await retryPendingEvidence(accidents, updateAccidentMetadata, io);
  } catch (error) {
    logger.error("Pending evidence retry scan failed", error.message);
  }
}

start();

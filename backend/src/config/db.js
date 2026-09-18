import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";
import "./env.js"; // ensures DATABASE_URL is loaded from .env before PrismaClient reads it

export const prisma = new PrismaClient();

let ready = false;
let retryTimer = null;

async function ping() {
  await prisma.$queryRaw`SELECT 1`;
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    try {
      await ping();
      ready = true;
      logger.info("Neon (Postgres) reconnected");
      clearInterval(retryTimer);
      retryTimer = null;
    } catch {
      // still down, keep retrying
    }
  }, 5000);
  retryTimer.unref?.();
}

export async function connectDatabase() {
  try {
    await ping();
    ready = true;
    logger.info("Neon (Postgres) connected");
    return true;
  } catch (error) {
    ready = false;
    logger.error(
      "Neon (Postgres) connection failed. API will still start using the in-memory buffer until the database is reachable.",
      error.message
    );
    scheduleRetry();
    return false;
  }
}

// Services call this whenever a live query fails, so a mid-session outage (e.g. a
// suspended Neon compute) is detected immediately instead of waiting for the next poll.
export function markDatabaseDown(error) {
  if (ready) {
    logger.error("Neon (Postgres) query failed, falling back to memory buffer", error?.message);
  }
  ready = false;
  scheduleRetry();
}

export function isDatabaseReady() {
  return ready;
}

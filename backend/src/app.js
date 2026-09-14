import http from "http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/index.js";
import { attachSockets } from "./sockets/index.js";

export function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigins,
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);
  attachSockets(io);
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: "Bike Black Box System API",
      docs: {
        health: "GET /api/health",
        status: "GET /api/status",
        telemetry: "POST /api/telemetry",
        accidents: "POST /api/accidents",
      },
    });
  });

  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return { app, server, io };
}
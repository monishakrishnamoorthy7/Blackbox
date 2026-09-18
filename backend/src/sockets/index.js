import { logger } from "../utils/logger.js";

export function attachSockets(io) {
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on("device:join", (deviceId) => {
      if (deviceId) {
        socket.join(`device:${deviceId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

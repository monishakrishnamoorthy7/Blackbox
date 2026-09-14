import { Router } from "express";
import {
  getAccidentBlockchain,
  getBlockchainServiceStatus,
  verifyAccidentBlockchain,
} from "../controllers/blockchainController.js";

export const blockchainRouter = Router();

blockchainRouter.get("/blockchain/status", getBlockchainServiceStatus);
blockchainRouter.get("/accidents/:id/blockchain", getAccidentBlockchain);
blockchainRouter.post("/accidents/:id/blockchain/verify", verifyAccidentBlockchain);

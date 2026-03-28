import type { Express } from "express";
import { type Server } from "http";
import authRoutes from "./routes/auth";
import plaidRoutes from "./routes/plaid";
import marketRoutes from "./routes/market";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Mount route modules
  app.use("/api/auth", authRoutes);
  app.use("/api/plaid", plaidRoutes);
  app.use("/api/market", marketRoutes);

  return httpServer;
}

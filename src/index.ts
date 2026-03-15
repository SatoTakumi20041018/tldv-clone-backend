import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import meetingRoutes from "./routes/meetings";
import transcriptRoutes from "./routes/transcripts";
import highlightRoutes from "./routes/highlights";
import summaryRoutes from "./routes/summaries";
import webhookRoutes from "./routes/webhooks";
import integrationRoutes from "./routes/integrations";
import healthRoutes from "./routes/health";
import teamRoutes from "./routes/teams";
import reportRoutes from "./routes/reports";
import prisma from "./utils/prisma";
import { initDb } from "./utils/initDb";

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"],
  },
});

// Security headers (helmet) + disable X-Powered-By
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  exposedHeaders: ["Content-Length"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/meetings", transcriptRoutes);
app.use("/api/v1/meetings", highlightRoutes);
app.use("/api/v1/meetings", summaryRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/integrations", integrationRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/health", healthRoutes);

app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json({
    name: "NotFound",
    message: "The requested endpoint does not exist",
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join:meeting", (meetingId: string) => {
    socket.join(`meeting:${meetingId}`);
    console.log(`Client ${socket.id} joined meeting room: ${meetingId}`);
  });

  socket.on("leave:meeting", (meetingId: string) => {
    socket.leave(`meeting:${meetingId}`);
    console.log(`Client ${socket.id} left meeting room: ${meetingId}`);
  });

  socket.on("join:team", (teamId: string) => {
    socket.join(`team:${teamId}`);
    console.log(`Client ${socket.id} joined team room: ${teamId}`);
  });

  socket.on("leave:team", (teamId: string) => {
    socket.leave(`team:${teamId}`);
    console.log(`Client ${socket.id} left team room: ${teamId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

export { app, io };

// Only start the server when not running in Vercel serverless
if (!process.env.VERCEL) {
  async function main() {
    try {
      await prisma.$connect();
      console.log("Database connected successfully");

      httpServer.listen(config.port, () => {
        console.log(`tl;dv backend server running on port ${config.port}`);
        console.log(`Health check: http://localhost:${config.port}/api/v1/health`);
        console.log(`Socket.IO enabled`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down...");
    await prisma.$disconnect();
    httpServer.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down...");
    await prisma.$disconnect();
    httpServer.close();
    process.exit(0);
  });

  main();
}

// Default export for Vercel serverless
export default app;

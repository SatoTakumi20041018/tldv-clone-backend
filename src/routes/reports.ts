import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import { generateAIReport, isAIAvailable } from "../services/aiService";
import prisma from "../utils/prisma";

const router = Router();

const generateReportSchema = z.object({
  meetingIds: z
    .array(z.string().uuid())
    .min(1, "At least one meeting ID is required")
    .max(50, "Maximum 50 meetings per report"),
  reportType: z
    .string()
    .trim()
    .min(1, "Report type is required")
    .max(100),
});

// POST /api/v1/reports/generate - Generate AI report across multiple meetings
router.post(
  "/generate",
  authenticate,
  validate(generateReportSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAIAvailable()) {
        res.status(503).json({
          name: "ServiceUnavailable",
          message: "AI features are not available. ANTHROPIC_API_KEY is not configured.",
        });
        return;
      }

      const { meetingIds, reportType } = req.body;

      // Fetch meetings with their summaries, only those belonging to the user
      const meetings = await prisma.meeting.findMany({
        where: {
          id: { in: meetingIds },
          organizerId: req.user!.id,
        },
        include: {
          aiSummaries: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (meetings.length === 0) {
        res.status(404).json({
          name: "NotFound",
          message: "No meetings found for the provided IDs.",
        });
        return;
      }

      // Build meeting data for the AI
      const meetingData = meetings.map((m) => {
        const latestSummary = m.aiSummaries[0];
        return {
          name: m.name,
          summary: latestSummary?.summary || "No summary available for this meeting.",
          date: m.happenedAt.toISOString().split("T")[0],
        };
      });

      const report = await generateAIReport(meetingData, reportType);

      res.json({
        ...report,
        meetingCount: meetings.length,
        meetingIds: meetings.map((m) => m.id),
        reportType,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate report";
      const isRateLimit = message.toLowerCase().includes("rate limit");
      const isTimeout = message.toLowerCase().includes("timeout");

      if (isRateLimit) {
        res.status(429).json({
          name: "RateLimited",
          message: "AI service is rate limited. Please try again in a moment.",
        });
        return;
      }
      if (isTimeout) {
        res.status(504).json({
          name: "GatewayTimeout",
          message: "AI request timed out. Please try again.",
        });
        return;
      }

      res.status(500).json({
        name: "InternalServerError",
        message,
      });
    }
  }
);

export default router;

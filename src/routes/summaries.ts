import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import { getSummary, generateSummary } from "../services/summaryService";
import { askAI, isAIAvailable } from "../services/aiService";
import { getTranscript } from "../services/transcriptService";

const router = Router();

const generateSummarySchema = z.object({
  template: z
    .enum(["default", "standup", "sales", "interview", "retrospective"])
    .optional(),
});

const askAISchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000),
});

router.get(
  "/:meetingId/summary",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const summary = await getSummary(req.params.meetingId as string, req.user!.id);
      res.json(summary);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const appError = error as { statusCode: number; name: string; message: string };
        res.status(appError.statusCode).json({
          name: appError.name,
          message: appError.message,
        });
        return;
      }
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error ? error.message : "Failed to get summary",
      });
    }
  }
);

router.post(
  "/:meetingId/summary/generate",
  authenticate,
  validate(generateSummarySchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const summary = await generateSummary(
        req.params.meetingId as string,
        req.user!.id,
        req.body.template
      );
      res.status(201).json(summary);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const appError = error as { statusCode: number; name: string; message: string };
        res.status(appError.statusCode).json({
          name: appError.name,
          message: appError.message,
        });
        return;
      }
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate summary",
      });
    }
  }
);

// POST /:meetingId/ask - Ask AI a question about a meeting
router.post(
  "/:meetingId/ask",
  authenticate,
  validate(askAISchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAIAvailable()) {
        res.status(503).json({
          name: "ServiceUnavailable",
          message: "AI features are not available. ANTHROPIC_API_KEY is not configured.",
        });
        return;
      }

      const transcript = await getTranscript(
        req.params.meetingId as string,
        req.user!.id
      );

      if (!transcript.segments || transcript.segments.length === 0) {
        res.status(400).json({
          name: "BadRequest",
          message: "No transcript available for this meeting.",
        });
        return;
      }

      const segments = transcript.segments.map((seg) => ({
        speaker: seg.speaker,
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
      }));

      const result = await askAI(req.body.question, segments);

      res.json(result);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const appError = error as { statusCode: number; name: string; message: string };
        res.status(appError.statusCode).json({
          name: appError.name,
          message: appError.message,
        });
        return;
      }
      // Handle Anthropic API errors gracefully
      const message = error instanceof Error ? error.message : "Failed to process AI request";
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

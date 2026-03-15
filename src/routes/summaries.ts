import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import { getSummary, generateSummary } from "../services/summaryService";

const router = Router();

const generateSummarySchema = z.object({
  template: z
    .enum(["default", "standup", "sales", "interview", "retrospective"])
    .optional(),
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

export default router;

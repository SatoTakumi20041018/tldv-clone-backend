import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import {
  getTranscript,
  createOrUpdateTranscript,
} from "../services/transcriptService";

const router = Router();

const createTranscriptSchema = z.object({
  segments: z
    .array(
      z.object({
        speaker: z.string().min(1, "Speaker name is required"),
        text: z.string().min(1, "Text is required"),
        startTime: z.number().min(0, "Start time must be non-negative"),
        endTime: z.number().min(0, "End time must be non-negative"),
      })
    )
    .min(1, "At least one segment is required"),
});

router.get(
  "/:meetingId/transcript",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const transcript = await getTranscript(
        req.params.meetingId as string,
        req.user!.id
      );
      res.json(transcript);
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
          error instanceof Error ? error.message : "Failed to get transcript",
      });
    }
  }
);

router.post(
  "/:meetingId/transcript",
  authenticate,
  validate(createTranscriptSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const transcript = await createOrUpdateTranscript(
        req.params.meetingId as string,
        req.body,
        req.user!.id
      );
      res.status(201).json(transcript);
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
            : "Failed to create transcript",
      });
    }
  }
);

export default router;

import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import {
  getHighlights,
  createHighlight,
  deleteHighlight,
} from "../services/highlightService";

const router = Router();

const createHighlightSchema = z.object({
  text: z.string().min(1, "Highlight text is required"),
  startTime: z.number().min(0).optional(),
  source: z.enum(["manual", "ai"]).optional(),
  topics: z
    .array(
      z.object({
        title: z.string().min(1, "Topic title is required"),
        summary: z.string().min(1, "Topic summary is required"),
      })
    )
    .optional(),
});

router.get(
  "/:meetingId/highlights",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const highlights = await getHighlights(
        req.params.meetingId as string,
        req.user!.id
      );
      res.json(highlights);
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
          error instanceof Error ? error.message : "Failed to get highlights",
      });
    }
  }
);

router.post(
  "/:meetingId/highlights",
  authenticate,
  validate(createHighlightSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const highlight = await createHighlight(
        req.params.meetingId as string,
        req.body,
        req.user!.id
      );
      res.status(201).json(highlight);
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
            : "Failed to create highlight",
      });
    }
  }
);

router.delete(
  "/:meetingId/highlights/:highlightId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await deleteHighlight(
        req.params.meetingId as string,
        req.params.highlightId as string,
        req.user!.id
      );
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
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete highlight",
      });
    }
  }
);

export default router;

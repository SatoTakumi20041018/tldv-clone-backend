import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import {
  listMeetings,
  getMeetingById,
  importMeeting,
  deleteMeeting,
  getMeetingDownloadUrl,
} from "../services/meetingService";

const router = Router();

const importMeetingSchema = z.object({
  name: z.string().trim().min(1, "Meeting name is required"),
  happenedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  duration: z.number().int().positive().optional(),
  url: z.string().url().optional(),
  recordingUrl: z.string().url().optional(),
  status: z.enum(["pending", "recording", "processing", "ready", "error"]).optional(),
  conferenceType: z.enum(["zoom", "meet", "teams"]).optional(),
  conferenceId: z.string().optional(),
  teamId: z.string().uuid().optional(),
  invitees: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })
    )
    .optional(),
});

router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const rawPage = parseInt(req.query.page as string);
      const page = isNaN(rawPage) ? 1 : Math.max(1, rawPage);
      const rawLimit = parseInt(req.query.pageSize as string || req.query.limit as string);
      const limit = isNaN(rawLimit) ? 20 : Math.max(1, rawLimit);
      const meetingType = req.query.meetingType as "internal" | "external" | undefined;
      const status = req.query.status as string | undefined;
      const conferenceType = req.query.conferenceType as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const search = req.query.search as string | undefined;
      const sort = (req.query.sort as string || req.query.order as string || "desc").toLowerCase();
      const sortBy = (req.query.sortBy as string || req.query.orderBy as string || "happenedAt");

      // Validate date params
      if (from && isNaN(Date.parse(from))) {
        res.status(400).json({ name: "ValidationError", message: "Invalid 'from' date format" });
        return;
      }
      if (to && isNaN(Date.parse(to))) {
        res.status(400).json({ name: "ValidationError", message: "Invalid 'to' date format" });
        return;
      }

      const result = await listMeetings({
        userId: req.user!.id,
        page,
        limit,
        meetingType,
        status,
        conferenceType,
        from,
        to,
        search,
        sort: sort === "asc" ? "asc" : "desc",
        sortBy,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message: error instanceof Error ? error.message : "Failed to list meetings",
      });
    }
  }
);

router.get(
  "/:meetingId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const meeting = await getMeetingById(req.params.meetingId as string, req.user!.id);
      res.json(meeting);
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
        message: error instanceof Error ? error.message : "Failed to get meeting",
      });
    }
  }
);

router.post(
  "/import",
  authenticate,
  validate(importMeetingSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const meeting = await importMeeting(req.body, req.user!.id);
      res.status(201).json(meeting);
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
        message: error instanceof Error ? error.message : "Failed to import meeting",
      });
    }
  }
);

router.get(
  "/:meetingId/download",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const downloadUrl = await getMeetingDownloadUrl(
        req.params.meetingId as string,
        req.user!.id
      );
      res.redirect(302, downloadUrl);
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
        message: error instanceof Error ? error.message : "Failed to get download URL",
      });
    }
  }
);

router.delete(
  "/:meetingId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await deleteMeeting(req.params.meetingId as string, req.user!.id);
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
        message: error instanceof Error ? error.message : "Failed to delete meeting",
      });
    }
  }
);

export default router;

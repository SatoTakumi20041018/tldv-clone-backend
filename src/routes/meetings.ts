import { Router, Response } from "express";
import { z } from "zod";
import multer from "multer";
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
import { processUploadedMeeting } from "../services/uploadService";

const router = Router();

// Multer config: memory storage for Vercel compatibility, 100MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",    // .mov
      "video/x-msvideo",    // .avi
    ];
    const allowedExtensions = /\.(mp4|webm|mov|avi)$/i;

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only MP4, WebM, MOV, and AVI files are allowed."));
    }
  },
});

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

// POST /upload - Upload a video file and generate simulated transcription
router.post(
  "/upload",
  authenticate,
  (req: AuthRequest, res: Response, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            name: "ValidationError",
            message: "File too large. Maximum size is 100MB.",
          });
          return;
        }
        res.status(400).json({
          name: "ValidationError",
          message: err.message,
        });
        return;
      }
      if (err) {
        res.status(400).json({
          name: "ValidationError",
          message: err.message,
        });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          name: "ValidationError",
          message: "No file uploaded. Please provide a video file in the 'file' field.",
        });
        return;
      }

      const name = req.body.name as string | undefined;
      const language = req.body.language as string | undefined;
      const teamId = req.body.teamId as string | undefined;

      // Simulate processing delay (2-3 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, 2000 + Math.random() * 1000)
      );

      const result = await processUploadedMeeting({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        name,
        language: language || "en",
        userId: req.user!.id,
        teamId,
      });

      res.status(201).json(result);
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
        message: error instanceof Error ? error.message : "Failed to process uploaded file",
      });
    }
  }
);

// GET /:meetingId/recording - Serve recording (placeholder for serverless)
router.get(
  "/:meetingId/recording",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const meeting = await getMeetingById(req.params.meetingId as string, req.user!.id);

      // In serverless, we can't persist files. Return a placeholder response.
      if (meeting.recordingUrl) {
        res.redirect(302, meeting.recordingUrl);
        return;
      }

      res.json({
        meetingId: meeting.id,
        message: "Recording is not available for download in serverless mode. " +
          "In production, recordings would be stored in a cloud storage service (e.g., S3) " +
          "and a signed URL would be provided.",
        recordingUrl: null,
        placeholder: true,
      });
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
        message: error instanceof Error ? error.message : "Failed to get recording",
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

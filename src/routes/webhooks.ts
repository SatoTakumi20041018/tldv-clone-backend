import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import {
  listWebhooks,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "../services/webhookService";

const router = Router();

const httpUrlSchema = z.string().url("Invalid webhook URL").refine(
  (url) => url.startsWith("http://") || url.startsWith("https://"),
  { message: "Webhook URL must use http or https protocol" }
);

const createWebhookSchema = z.object({
  url: httpUrlSchema,
  events: z
    .array(
      z.enum([
        "MeetingReady",
        "TranscriptReady",
        "HighlightCreated",
        "SummaryGenerated",
      ])
    )
    .min(1, "At least one event is required"),
  teamId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

const updateWebhookSchema = z.object({
  url: httpUrlSchema.optional(),
  events: z
    .array(
      z.enum([
        "MeetingReady",
        "TranscriptReady",
        "HighlightCreated",
        "SummaryGenerated",
      ])
    )
    .min(1, "At least one event is required")
    .optional(),
  active: z.boolean().optional(),
});

router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const webhooks = await listWebhooks(req.user!.id);
      res.json(webhooks);
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error ? error.message : "Failed to list webhooks",
      });
    }
  }
);

router.get(
  "/:webhookId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const webhook = await getWebhookById(req.params.webhookId as string, req.user!.id);
      res.json(webhook);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const appError = error as { statusCode: number; name: string; message: string };
        res.status(appError.statusCode).json({ name: appError.name, message: appError.message });
        return;
      }
      res.status(500).json({ name: "InternalServerError", message: "Failed to get webhook" });
    }
  }
);

router.post(
  "/",
  authenticate,
  validate(createWebhookSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const webhook = await createWebhook(req.body, req.user!.id);
      res.status(201).json(webhook);
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
          error instanceof Error ? error.message : "Failed to create webhook",
      });
    }
  }
);

router.put(
  "/:webhookId",
  authenticate,
  validate(updateWebhookSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const webhook = await updateWebhook(
        req.params.webhookId as string,
        req.body,
        req.user!.id
      );
      res.json(webhook);
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
          error instanceof Error ? error.message : "Failed to update webhook",
      });
    }
  }
);

router.delete(
  "/:webhookId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await deleteWebhook(req.params.webhookId as string, req.user!.id);
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
          error instanceof Error ? error.message : "Failed to delete webhook",
      });
    }
  }
);

export default router;

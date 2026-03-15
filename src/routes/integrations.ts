import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import {
  listIntegrations,
  getIntegrationById,
  createIntegration,
  updateIntegration,
  deleteIntegration,
} from "../services/integrationService";

const router = Router();

const createIntegrationSchema = z.object({
  type: z.enum(["hubspot", "salesforce", "slack", "notion", "zapier"], {
    errorMap: () => ({
      message:
        "Type must be one of: hubspot, salesforce, slack, notion, zapier",
    }),
  }),
  config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

const updateIntegrationSchema = z.object({
  config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integrations = await listIntegrations(req.user!.id);
      res.json(integrations);
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error
            ? error.message
            : "Failed to list integrations",
      });
    }
  }
);

router.get(
  "/:integrationId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integration = await getIntegrationById(req.params.integrationId as string, req.user!.id);
      res.json(integration);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const appError = error as { statusCode: number; name: string; message: string };
        res.status(appError.statusCode).json({ name: appError.name, message: appError.message });
        return;
      }
      res.status(500).json({ name: "InternalServerError", message: "Failed to get integration" });
    }
  }
);

router.post(
  "/",
  authenticate,
  validate(createIntegrationSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integration = await createIntegration(req.body, req.user!.id);
      res.status(201).json(integration);
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
            : "Failed to create integration",
      });
    }
  }
);

router.put(
  "/:integrationId",
  authenticate,
  validate(updateIntegrationSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const integration = await updateIntegration(
        req.params.integrationId as string,
        req.body,
        req.user!.id
      );
      res.json(integration);
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
            : "Failed to update integration",
      });
    }
  }
);

router.delete(
  "/:integrationId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await deleteIntegration(
        req.params.integrationId as string,
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
            : "Failed to delete integration",
      });
    }
  }
);

export default router;

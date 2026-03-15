import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config";
import prisma from "../utils/prisma";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateApiKey } from "../utils/apiKey";
import { AuthRequest } from "../types";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { name: "TooManyRequests", message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

router.post(
  "/register",
  validate(registerSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, name, password } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(400).json({
          message: "Validation failed",
          errors: [
            {
              property: "email",
              constraints: { unique: "Email already registered" },
            },
          ],
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.status(201).json({
        user,
        token,
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        res.status(400).json({
          message: "Validation failed",
          errors: [{ property: "email", constraints: { unique: "Email already registered" } }],
        });
        return;
      }
      res.status(500).json({
        name: "InternalServerError",
        message: "Registration failed",
      });
    }
  }
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res.status(401).json({
          name: "Unauthorized",
          message: "Invalid email or password",
        });
        return;
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        res.status(401).json({
          name: "Unauthorized",
          message: "Invalid email or password",
        });
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message: error instanceof Error ? error.message : "Login failed",
      });
    }
  }
);

router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          apiKey: true,
          createdAt: true,
          updatedAt: true,
          teamMembers: {
            include: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          name: "NotFound",
          message: "User not found",
        });
        return;
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message: error instanceof Error ? error.message : "Failed to get user",
      });
    }
  }
);

router.post(
  "/api-key",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const apiKey = generateApiKey();

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { apiKey },
      });

      res.json({ apiKey });
    } catch (error) {
      res.status(500).json({
        name: "InternalServerError",
        message:
          error instanceof Error ? error.message : "Failed to generate API key",
      });
    }
  }
);

export default router;

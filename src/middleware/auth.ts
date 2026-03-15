import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../utils/prisma";
import { AuthRequest, AuthUser } from "../types";

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (apiKey) {
      const user = await prisma.user.findUnique({
        where: { apiKey },
        select: { id: true, email: true, name: true, role: true },
      });
      if (user) {
        req.user = user as AuthUser;
        return next();
      }
      res.status(401).json({
        name: "Unauthorized",
        message: "Invalid API key",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      res.status(401).json({
        name: "Unauthorized",
        message: "No authentication token provided. Use Bearer token or x-api-key header.",
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      res.status(401).json({
        name: "Unauthorized",
        message: "User not found",
      });
      return;
    }

    req.user = user as AuthUser;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        name: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }
    next(error);
  }
}

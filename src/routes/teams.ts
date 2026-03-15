import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AuthRequest } from "../types";
import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";

const router = Router();

const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100),
});

const addMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(["owner", "admin", "member"]).optional(),
});

// List user's teams
router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const memberships = await prisma.teamMember.findMany({
        where: { userId: req.user!.id },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, email: true, name: true } },
                },
              },
            },
          },
        },
      });
      res.json(memberships.map((m) => ({ ...m.team, myRole: m.role })));
    } catch (error) {
      res.status(500).json({ name: "InternalServerError", message: "Failed to list teams" });
    }
  }
);

// Create team
router.post(
  "/",
  authenticate,
  validate(createTeamSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const team = await prisma.team.create({
        data: {
          name: req.body.name,
          members: {
            create: { userId: req.user!.id, role: "owner" },
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });
      res.status(201).json(team);
    } catch (error) {
      res.status(500).json({ name: "InternalServerError", message: "Failed to create team" });
    }
  }
);

// Get team by ID
router.get(
  "/:teamId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: { userId: req.user!.id, teamId: req.params.teamId },
        },
      });
      if (!membership) {
        res.status(404).json({ name: "NotFound", message: "Team not found" });
        return;
      }
      const team = await prisma.team.findUnique({
        where: { id: req.params.teamId },
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });
      res.json(team);
    } catch (error) {
      res.status(500).json({ name: "InternalServerError", message: "Failed to get team" });
    }
  }
);

// Add member to team
router.post(
  "/:teamId/members",
  authenticate,
  validate(addMemberSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: { userId: req.user!.id, teamId: req.params.teamId },
        },
      });
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        res.status(403).json({ name: "Forbidden", message: "Not authorized to add members" });
        return;
      }
      const member = await prisma.teamMember.create({
        data: {
          userId: req.body.userId,
          teamId: req.params.teamId,
          role: req.body.role || "member",
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });
      res.status(201).json(member);
    } catch (error: any) {
      if (error?.code === "P2002") {
        res.status(400).json({ name: "ValidationError", message: "User is already a team member" });
        return;
      }
      if (error?.code === "P2003") {
        res.status(404).json({ name: "NotFound", message: "User not found" });
        return;
      }
      res.status(500).json({ name: "InternalServerError", message: "Failed to add member" });
    }
  }
);

// Remove member from team
router.delete(
  "/:teamId/members/:userId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: { userId: req.user!.id, teamId: req.params.teamId },
        },
      });
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        res.status(403).json({ name: "Forbidden", message: "Not authorized to remove members" });
        return;
      }
      await prisma.teamMember.delete({
        where: {
          userId_teamId: { userId: req.params.userId, teamId: req.params.teamId },
        },
      });
      res.json({ message: "Member removed successfully" });
    } catch (error) {
      res.status(500).json({ name: "InternalServerError", message: "Failed to remove member" });
    }
  }
);

// Delete team
router.delete(
  "/:teamId",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: { userId: req.user!.id, teamId: req.params.teamId },
        },
      });
      if (!membership || membership.role !== "owner") {
        res.status(403).json({ name: "Forbidden", message: "Only team owner can delete the team" });
        return;
      }
      await prisma.team.delete({ where: { id: req.params.teamId } });
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      res.status(500).json({ name: "InternalServerError", message: "Failed to delete team" });
    }
  }
);

export default router;

import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";
import { config } from "../config";
import { fireWebhookEvent } from "../utils/webhook";

export interface CreateMeetingData {
  name: string;
  happenedAt: string;
  duration?: number;
  url?: string;
  recordingUrl?: string;
  status?: string;
  conferenceType?: string;
  conferenceId?: string;
  teamId?: string;
  invitees?: { name: string; email: string }[];
}

export interface MeetingListOptions {
  userId: string;
  page: number;
  limit: number;
  meetingType?: "internal" | "external";
  status?: string;
  conferenceType?: string;
  from?: string;
  to?: string;
  search?: string;
  sort?: "asc" | "desc";
  sortBy?: string;
}

export async function listMeetings(options: MeetingListOptions) {
  const { userId, page, limit, meetingType, status, conferenceType, from, to, search, sort = "desc", sortBy = "happenedAt" } = options;

  const where: Record<string, unknown> = {
    organizerId: userId,
  };

  if (status) {
    where.status = status;
  }

  if (conferenceType) {
    where.conferenceType = conferenceType;
  }

  if (from || to) {
    const happenedAt: Record<string, Date> = {};
    if (from) happenedAt.gte = new Date(from);
    if (to) happenedAt.lte = new Date(to);
    where.happenedAt = happenedAt;
  }

  if (meetingType === "internal") {
    where.invitees = { none: {} };
  } else if (meetingType === "external") {
    where.invitees = { some: {} };
  }

  // Search by meeting name
  if (search && search.trim()) {
    where.name = { contains: search.trim() };
  }

  const skip = (page - 1) * limit;
  const safeLimit = Math.min(limit, config.maxPageSize);

  // Determine sort field (only allow safe fields)
  const allowedSortFields = ["happenedAt", "name", "duration", "createdAt", "status"];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "happenedAt";

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: {
        invitees: true,
        organizer: { select: { id: true, email: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { [safeSortBy]: sort },
      skip,
      take: safeLimit,
    }),
    prisma.meeting.count({ where }),
  ]);

  return {
    data: meetings,
    pagination: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getMeetingById(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      organizerId: userId,
    },
    include: {
      invitees: true,
      organizer: { select: { id: true, email: true, name: true } },
      team: { select: { id: true, name: true } },
      transcripts: {
        include: {
          segments: { orderBy: { startTime: "asc" } },
        },
      },
      highlights: {
        include: { topics: true },
        orderBy: { createdAt: "desc" },
      },
      aiSummaries: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  return meeting;
}

export async function importMeeting(data: CreateMeetingData, userId: string) {
  const meeting = await prisma.meeting.create({
    data: {
      name: data.name,
      happenedAt: new Date(data.happenedAt),
      duration: data.duration,
      url: data.url,
      recordingUrl: data.recordingUrl,
      status: data.status || "ready",
      conferenceType: data.conferenceType,
      conferenceId: data.conferenceId,
      organizerId: userId,
      teamId: data.teamId,
      invitees: data.invitees
        ? {
            create: data.invitees.map((inv) => ({
              name: inv.name,
              email: inv.email,
            })),
          }
        : undefined,
    },
    include: {
      invitees: true,
      organizer: { select: { id: true, email: true, name: true } },
      team: { select: { id: true, name: true } },
    },
  });

  if (meeting.status === "ready") {
    fireWebhookEvent(
      "MeetingReady",
      {
        meetingId: meeting.id,
        name: meeting.name,
        happenedAt: meeting.happenedAt.toISOString(),
        organizerId: meeting.organizerId,
      },
      userId,
      meeting.teamId
    ).catch(console.error);
  }

  return meeting;
}

export async function deleteMeeting(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  await prisma.meeting.delete({ where: { id: meetingId } });
  return { message: "Meeting deleted successfully" };
}

export async function getMeetingDownloadUrl(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  if (!meeting.recordingUrl) {
    throw new NotFoundError("No recording available for this meeting");
  }

  return meeting.recordingUrl;
}

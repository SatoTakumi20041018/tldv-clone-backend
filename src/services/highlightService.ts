import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";
import { fireWebhookEvent } from "../utils/webhook";

export interface CreateHighlightData {
  text: string;
  startTime?: number;
  source?: string;
  topics?: { title: string; summary: string }[];
}

export async function getHighlights(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const highlights = await prisma.highlight.findMany({
    where: { meetingId },
    include: { topics: true },
    orderBy: { createdAt: "desc" },
  });

  return highlights;
}

export async function createHighlight(
  meetingId: string,
  data: CreateHighlightData,
  userId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const highlight = await prisma.highlight.create({
    data: {
      meetingId,
      text: data.text,
      startTime: data.startTime,
      source: data.source || "manual",
      topics: data.topics
        ? {
            create: data.topics.map((t) => ({
              title: t.title,
              summary: t.summary,
            })),
          }
        : undefined,
    },
    include: { topics: true },
  });

  fireWebhookEvent(
    "HighlightCreated",
    {
      meetingId,
      highlightId: highlight.id,
      text: highlight.text,
      source: highlight.source,
    },
    userId,
    meeting.teamId
  ).catch(console.error);

  return highlight;
}

export async function deleteHighlight(
  meetingId: string,
  highlightId: string,
  userId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const highlight = await prisma.highlight.findFirst({
    where: { id: highlightId, meetingId },
  });

  if (!highlight) {
    throw new NotFoundError("Highlight not found");
  }

  await prisma.highlight.delete({ where: { id: highlightId } });

  return { message: "Highlight deleted successfully" };
}

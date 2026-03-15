import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";
import { fireWebhookEvent } from "../utils/webhook";

export interface CreateTranscriptData {
  segments: {
    speaker: string;
    text: string;
    startTime: number;
    endTime: number;
  }[];
}

export async function getTranscript(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const transcript = await prisma.transcript.findFirst({
    where: { meetingId },
    include: {
      segments: {
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!transcript) {
    throw new NotFoundError("Transcript not found for this meeting");
  }

  return transcript;
}

export async function createOrUpdateTranscript(
  meetingId: string,
  data: CreateTranscriptData,
  userId: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const existingTranscript = await prisma.transcript.findFirst({
    where: { meetingId },
  });

  if (existingTranscript) {
    await prisma.transcriptSegment.deleteMany({
      where: { transcriptId: existingTranscript.id },
    });

    const updated = await prisma.transcript.update({
      where: { id: existingTranscript.id },
      data: {
        segments: {
          create: data.segments.map((seg) => ({
            speaker: seg.speaker,
            text: seg.text,
            startTime: seg.startTime,
            endTime: seg.endTime,
          })),
        },
      },
      include: {
        segments: { orderBy: { startTime: "asc" } },
      },
    });

    fireWebhookEvent(
      "TranscriptReady",
      {
        meetingId,
        transcriptId: updated.id,
        segmentCount: updated.segments.length,
      },
      userId,
      meeting.teamId
    ).catch(console.error);

    return updated;
  }

  const transcript = await prisma.transcript.create({
    data: {
      meetingId,
      segments: {
        create: data.segments.map((seg) => ({
          speaker: seg.speaker,
          text: seg.text,
          startTime: seg.startTime,
          endTime: seg.endTime,
        })),
      },
    },
    include: {
      segments: { orderBy: { startTime: "asc" } },
    },
  });

  fireWebhookEvent(
    "TranscriptReady",
    {
      meetingId,
      transcriptId: transcript.id,
      segmentCount: transcript.segments.length,
    },
    userId,
    meeting.teamId
  ).catch(console.error);

  return transcript;
}

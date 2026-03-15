import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";
import { fireWebhookEvent } from "../utils/webhook";

export async function getSummary(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const summary = await prisma.aISummary.findFirst({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });

  if (!summary) {
    throw new NotFoundError("No AI summary found for this meeting");
  }

  return {
    ...summary,
    actionItems: JSON.parse(summary.actionItems),
    decisions: JSON.parse(summary.decisions),
  };
}

export async function generateSummary(
  meetingId: string,
  userId: string,
  template?: string
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, organizerId: userId },
    include: {
      transcripts: {
        include: {
          segments: { orderBy: { startTime: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      highlights: {
        include: { topics: true },
      },
      invitees: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("Meeting not found");
  }

  const transcript = meeting.transcripts[0];
  const segments = transcript?.segments || [];
  const highlights = meeting.highlights;

  const speakers = [...new Set(segments.map((s) => s.speaker))];
  const totalDuration =
    segments.length > 0
      ? segments[segments.length - 1].endTime - segments[0].startTime
      : meeting.duration || 0;

  const topicSummaries = highlights
    .flatMap((h) => h.topics)
    .map((t) => t.title);

  const summaryText = generateMockSummary(
    meeting.name,
    speakers,
    totalDuration,
    segments.length,
    topicSummaries
  );

  const actionItems = extractMockActionItems(segments, speakers);
  const decisions = extractMockDecisions(segments, highlights);

  const summary = await prisma.aISummary.create({
    data: {
      meetingId,
      summary: summaryText,
      actionItems: JSON.stringify(actionItems),
      decisions: JSON.stringify(decisions),
      template: template || "default",
    },
  });

  fireWebhookEvent(
    "SummaryGenerated",
    {
      meetingId,
      summaryId: summary.id,
      template: summary.template,
    },
    userId,
    meeting.teamId
  ).catch(console.error);

  return {
    ...summary,
    actionItems,
    decisions,
  };
}

function generateMockSummary(
  meetingName: string,
  speakers: string[],
  durationSeconds: number,
  segmentCount: number,
  topics: string[]
): string {
  const durationMinutes = Math.round(durationSeconds / 60);
  const speakerList = speakers.join(", ");
  const topicList =
    topics.length > 0 ? topics.join(", ") : "general discussion";

  return (
    `Meeting "${meetingName}" lasted approximately ${durationMinutes} minutes ` +
    `with ${speakers.length} participant(s): ${speakerList}. ` +
    `The meeting covered ${segmentCount} transcript segments across the following topics: ${topicList}. ` +
    `Key discussions focused on project updates, action items assignment, and decision-making. ` +
    `The participants reviewed progress on current initiatives and identified areas requiring follow-up.`
  );
}

function extractMockActionItems(
  segments: { speaker: string; text: string }[],
  speakers: string[]
): { assignee: string; task: string; deadline?: string }[] {
  const items: { assignee: string; task: string; deadline?: string }[] = [];

  if (segments.length === 0) {
    return [
      {
        assignee: speakers[0] || "Unassigned",
        task: "Review meeting notes and follow up on open items",
      },
    ];
  }

  const actionKeywords = [
    "will",
    "should",
    "need to",
    "going to",
    "must",
    "action",
    "todo",
    "follow up",
  ];

  for (const segment of segments) {
    const lower = segment.text.toLowerCase();
    const hasActionKeyword = actionKeywords.some((kw) => lower.includes(kw));
    if (hasActionKeyword && items.length < 5) {
      items.push({
        assignee: segment.speaker,
        task: segment.text.substring(0, 200),
      });
    }
  }

  if (items.length === 0) {
    items.push({
      assignee: speakers[0] || "Team",
      task: "Review meeting outcomes and share summary with stakeholders",
    });
  }

  return items;
}

function extractMockDecisions(
  segments: { speaker: string; text: string }[],
  highlights: { text: string; source: string }[]
): { decision: string; context?: string }[] {
  const decisions: { decision: string; context?: string }[] = [];

  for (const highlight of highlights) {
    if (decisions.length < 5) {
      decisions.push({
        decision: highlight.text.substring(0, 200),
        context: `Source: ${highlight.source}`,
      });
    }
  }

  if (decisions.length === 0) {
    const decisionKeywords = [
      "decided",
      "agreed",
      "approved",
      "confirmed",
      "resolved",
    ];
    for (const segment of segments) {
      const lower = segment.text.toLowerCase();
      const hasDecisionKeyword = decisionKeywords.some((kw) =>
        lower.includes(kw)
      );
      if (hasDecisionKeyword && decisions.length < 5) {
        decisions.push({
          decision: segment.text.substring(0, 200),
          context: `Stated by ${segment.speaker}`,
        });
      }
    }
  }

  if (decisions.length === 0) {
    decisions.push({
      decision: "No explicit decisions were recorded in this meeting",
    });
  }

  return decisions;
}

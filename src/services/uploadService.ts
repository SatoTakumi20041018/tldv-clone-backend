import prisma from "../utils/prisma";
import { fireWebhookEvent } from "../utils/webhook";

export interface UploadMeetingOptions {
  fileName: string;
  fileSize: number;
  mimeType: string;
  name?: string;
  language?: string;
  userId: string;
  teamId?: string;
}

// Speaker names pool for realistic transcript generation
const SPEAKER_NAMES = [
  "Sarah Chen",
  "Marcus Johnson",
  "Emily Rodriguez",
  "David Kim",
  "Rachel Thompson",
  "Alex Patel",
  "Jordan Lee",
  "Olivia Martinez",
  "Ryan O'Brien",
  "Priya Sharma",
];

// Meeting dialogue templates by category
const OPENING_PHRASES = [
  "Alright, let's get started. Thanks everyone for joining today.",
  "Good morning everyone. Let's jump right in.",
  "Hey team, thanks for making time for this. Let's begin.",
  "Okay, looks like everyone's here. Let's kick things off.",
];

const STATUS_UPDATE_PHRASES = [
  "So on my end, I've been working on {topic} and we're making good progress. We should have it wrapped up by end of week.",
  "I wanted to give a quick update on {topic}. We hit a small blocker but found a workaround yesterday.",
  "For {topic}, we're about 80% done. The remaining pieces are mostly testing and documentation.",
  "Things are moving along well with {topic}. I'll share the latest draft with everyone after this call.",
  "We ran into some issues with {topic} last week, but the team has been great and we're back on track now.",
];

const DISCUSSION_PHRASES = [
  "That's a great point. I think we should also consider the impact on {topic}.",
  "I agree with that approach. One thing I'd add is that we need to make sure {topic} is covered.",
  "Can we circle back on {topic}? I have a few concerns about the timeline.",
  "I've been thinking about {topic} and I believe we should prioritize it for this sprint.",
  "Has anyone looked into {topic}? I think it could be a game changer for us.",
  "I want to flag a potential risk with {topic}. We might need to allocate more resources.",
  "From the customer feedback we received, {topic} seems to be the top priority.",
  "Let me share my screen and walk you through the latest on {topic}.",
];

const ACTION_ITEM_PHRASES = [
  "I'll take the action to follow up on {topic} and share the results by Friday.",
  "Let me schedule a deep dive on {topic} with the relevant stakeholders.",
  "I need to coordinate with the engineering team on {topic}. I'll set up a meeting this week.",
  "Can you send me the latest data on {topic}? I'll need it for the report.",
  "I'll draft a proposal for {topic} and circulate it for feedback before our next meeting.",
  "We should set up a dedicated channel for {topic} so we can track progress asynchronously.",
];

const DECISION_PHRASES = [
  "Okay, so we've decided to go with option A for {topic}. Everyone aligned?",
  "Let's agree on this: we'll prioritize {topic} for the next quarter.",
  "I think we've reached consensus here. We'll move forward with {topic} as planned.",
  "After discussing the options, we've agreed that {topic} is the best path forward.",
];

const CLOSING_PHRASES = [
  "Great, I think we covered everything. Let me send out the action items after this.",
  "Thanks everyone for a productive meeting. Let's reconvene next week with updates.",
  "Alright, that's a wrap. I'll share the meeting notes shortly.",
  "Good discussion today. Let's make sure we follow through on the action items we identified.",
];

const MEETING_TOPICS = [
  "the product roadmap",
  "the Q4 targets",
  "the new feature rollout",
  "the customer onboarding flow",
  "the performance optimization",
  "the infrastructure migration",
  "the design system update",
  "the API integration",
  "the security audit findings",
  "the marketing campaign",
  "the budget allocation",
  "the hiring plan",
  "the user research results",
  "the sprint retrospective",
  "the deployment pipeline",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function fillTopic(template: string, topic: string): string {
  return template.replace("{topic}", topic);
}

function extractMeetingName(fileName: string): string {
  // Strip extension and clean up
  return fileName
    .replace(/\.(mp4|webm|mov|avi)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateDuration(fileSize: number): number {
  // Rough estimate: ~1MB per minute for compressed video
  // Returns duration in seconds, min 5 minutes, max 120 minutes
  const estimatedMinutes = Math.max(5, Math.min(120, Math.round(fileSize / (1024 * 1024))));
  return estimatedMinutes * 60;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

function generateTranscriptSegments(
  meetingName: string,
  durationSeconds: number
): TranscriptSegment[] {
  const segmentCount = Math.max(15, Math.min(30, Math.round(durationSeconds / 60) * 2));
  const numSpeakers = Math.min(5, Math.max(2, Math.round(segmentCount / 6)));
  const speakers = pickRandomN(SPEAKER_NAMES, numSpeakers);
  const topics = pickRandomN(MEETING_TOPICS, Math.min(5, Math.max(2, Math.round(segmentCount / 5))));

  const segments: TranscriptSegment[] = [];
  let currentTime = 0;
  const avgSegmentDuration = durationSeconds / segmentCount;

  for (let i = 0; i < segmentCount; i++) {
    const speaker = i === 0 ? speakers[0] : pickRandom(speakers);
    let text: string;
    const topic = pickRandom(topics);

    if (i === 0) {
      // Opening
      text = pickRandom(OPENING_PHRASES);
    } else if (i === segmentCount - 1) {
      // Closing
      text = pickRandom(CLOSING_PHRASES);
    } else if (i < segmentCount * 0.3) {
      // Early: status updates
      text = fillTopic(pickRandom(STATUS_UPDATE_PHRASES), topic);
    } else if (i < segmentCount * 0.7) {
      // Middle: discussion
      if (Math.random() < 0.3) {
        text = fillTopic(pickRandom(DECISION_PHRASES), topic);
      } else {
        text = fillTopic(pickRandom(DISCUSSION_PHRASES), topic);
      }
    } else {
      // Late: action items and wrapping up
      if (Math.random() < 0.5) {
        text = fillTopic(pickRandom(ACTION_ITEM_PHRASES), topic);
      } else {
        text = fillTopic(pickRandom(DISCUSSION_PHRASES), topic);
      }
    }

    // Add variation to segment duration (0.5x to 1.5x average)
    const segDuration = avgSegmentDuration * (0.5 + Math.random());
    const startTime = Math.round(currentTime * 100) / 100;
    const endTime = Math.round((currentTime + segDuration) * 100) / 100;

    segments.push({ speaker, text, startTime, endTime });
    currentTime = endTime + (Math.random() * 2); // Small gap between segments
  }

  return segments;
}

interface GeneratedSummary {
  summary: string;
  actionItems: { assignee: string; task: string; deadline?: string }[];
  decisions: { decision: string; context?: string }[];
  keyPoints: string[];
}

function generateSummaryFromTranscript(
  meetingName: string,
  segments: TranscriptSegment[]
): GeneratedSummary {
  const speakers = [...new Set(segments.map((s) => s.speaker))];
  const totalDuration = segments.length > 0
    ? segments[segments.length - 1].endTime - segments[0].startTime
    : 0;
  const durationMinutes = Math.round(totalDuration / 60);

  // Build summary text
  const summary =
    `This ${durationMinutes}-minute meeting "${meetingName}" included ${speakers.length} participants: ${speakers.join(", ")}. ` +
    `The discussion covered key project updates, with team members sharing progress on their respective workstreams. ` +
    `Several important decisions were made regarding project priorities and resource allocation. ` +
    `The team identified action items and assigned owners for follow-up tasks. ` +
    `Overall, the meeting was productive with clear next steps established for all participants.`;

  // Extract action items from segments that contain action-like language
  const actionItems: { assignee: string; task: string; deadline?: string }[] = [];
  const actionKeywords = ["follow up", "I'll", "need to", "going to", "schedule", "draft", "send", "set up"];
  for (const segment of segments) {
    if (actionItems.length >= 5) break;
    const lower = segment.text.toLowerCase();
    if (actionKeywords.some((kw) => lower.includes(kw))) {
      actionItems.push({
        assignee: segment.speaker,
        task: segment.text,
        deadline: Math.random() > 0.5 ? "End of week" : undefined,
      });
    }
  }
  if (actionItems.length < 3) {
    actionItems.push(
      { assignee: speakers[0], task: "Share meeting notes and summary with the team", deadline: "Today" },
      { assignee: speakers[Math.min(1, speakers.length - 1)], task: "Review action items and confirm ownership", deadline: "Tomorrow" },
      { assignee: speakers[0], task: "Schedule follow-up meeting for next week" },
    );
  }

  // Extract decisions
  const decisions: { decision: string; context?: string }[] = [];
  const decisionKeywords = ["decided", "agreed", "go with", "consensus", "move forward", "prioritize"];
  for (const segment of segments) {
    if (decisions.length >= 3) break;
    const lower = segment.text.toLowerCase();
    if (decisionKeywords.some((kw) => lower.includes(kw))) {
      decisions.push({
        decision: segment.text,
        context: `Proposed by ${segment.speaker}`,
      });
    }
  }
  if (decisions.length < 2) {
    decisions.push(
      { decision: "Team agreed to proceed with the current plan and review progress next week", context: "Group consensus" },
      { decision: "Resource allocation will be reviewed based on Q4 priorities", context: `Led by ${speakers[0]}` },
    );
  }

  // Key points
  const keyPoints = [
    `${speakers[0]} provided a comprehensive project status update`,
    `Team discussed potential risks and mitigation strategies`,
    `Action items were assigned with clear deadlines`,
    decisions[0] ? `Key decision: ${decisions[0].decision.substring(0, 100)}` : "Multiple topics were covered in depth",
    `Follow-up meeting scheduled to track progress`,
  ].slice(0, Math.max(3, Math.min(5, Math.round(segments.length / 5))));

  return { summary, actionItems: actionItems.slice(0, 5), decisions: decisions.slice(0, 3), keyPoints };
}

interface GeneratedHighlight {
  text: string;
  startTime: number;
  topics: { title: string; summary: string }[];
}

function generateHighlights(
  segments: TranscriptSegment[]
): GeneratedHighlight[] {
  const highlights: GeneratedHighlight[] = [];
  const importantKeywords = ["decided", "agreed", "important", "key", "critical", "prioritize", "deadline", "follow up", "blocker", "risk"];

  // Pick segments that seem important
  for (const segment of segments) {
    if (highlights.length >= 5) break;
    const lower = segment.text.toLowerCase();
    if (importantKeywords.some((kw) => lower.includes(kw))) {
      highlights.push({
        text: `${segment.speaker}: "${segment.text}"`,
        startTime: segment.startTime,
        topics: [
          {
            title: `Key moment at ${Math.round(segment.startTime / 60)}:${String(Math.round(segment.startTime % 60)).padStart(2, "0")}`,
            summary: segment.text,
          },
        ],
      });
    }
  }

  // Ensure at least 3 highlights
  if (highlights.length < 3 && segments.length > 0) {
    // Pick evenly spaced segments
    const step = Math.floor(segments.length / (3 - highlights.length + 1));
    for (let i = step; highlights.length < 3 && i < segments.length; i += step) {
      const seg = segments[i];
      highlights.push({
        text: `${seg.speaker}: "${seg.text}"`,
        startTime: seg.startTime,
        topics: [
          {
            title: `Discussion point at ${Math.round(seg.startTime / 60)}:${String(Math.round(seg.startTime % 60)).padStart(2, "0")}`,
            summary: seg.text,
          },
        ],
      });
    }
  }

  return highlights.slice(0, 5);
}

export async function processUploadedMeeting(options: UploadMeetingOptions) {
  const {
    fileName,
    fileSize,
    mimeType,
    name,
    language = "en",
    userId,
    teamId,
  } = options;

  const meetingName = name || extractMeetingName(fileName);
  const durationSeconds = estimateDuration(fileSize);

  // 1. Create meeting with "processing" status
  const meeting = await prisma.meeting.create({
    data: {
      name: meetingName,
      happenedAt: new Date(),
      duration: durationSeconds,
      status: "processing",
      organizerId: userId,
      teamId: teamId || undefined,
    },
  });

  // 2. Generate simulated transcript
  const segments = generateTranscriptSegments(meetingName, durationSeconds);

  // 3. Create transcript in database
  const transcript = await prisma.transcript.create({
    data: {
      meetingId: meeting.id,
      segments: {
        create: segments.map((seg) => ({
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

  // 4. Generate summary from transcript
  const summaryData = generateSummaryFromTranscript(meetingName, segments);

  const aiSummary = await prisma.aISummary.create({
    data: {
      meetingId: meeting.id,
      summary: summaryData.summary,
      actionItems: JSON.stringify(summaryData.actionItems),
      decisions: JSON.stringify(summaryData.decisions),
      template: "default",
    },
  });

  // 5. Generate highlights
  const highlightData = generateHighlights(segments);
  const highlights = [];
  for (const h of highlightData) {
    const highlight = await prisma.highlight.create({
      data: {
        meetingId: meeting.id,
        text: h.text,
        startTime: h.startTime,
        source: "ai",
        topics: {
          create: h.topics.map((t) => ({
            title: t.title,
            summary: t.summary,
          })),
        },
      },
      include: { topics: true },
    });
    highlights.push(highlight);
  }

  // 6. Update meeting status to "ready"
  const updatedMeeting = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "ready" },
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

  // Fire webhook events
  fireWebhookEvent(
    "MeetingReady",
    {
      meetingId: meeting.id,
      name: meetingName,
      happenedAt: meeting.happenedAt.toISOString(),
      organizerId: userId,
    },
    userId,
    teamId
  ).catch(console.error);

  fireWebhookEvent(
    "TranscriptReady",
    {
      meetingId: meeting.id,
      transcriptId: transcript.id,
      segmentCount: transcript.segments.length,
    },
    userId,
    teamId
  ).catch(console.error);

  fireWebhookEvent(
    "SummaryGenerated",
    {
      meetingId: meeting.id,
      summaryId: aiSummary.id,
      template: "default",
    },
    userId,
    teamId
  ).catch(console.error);

  // Parse JSON fields for response
  return {
    ...updatedMeeting,
    aiSummaries: updatedMeeting.aiSummaries.map((s) => ({
      ...s,
      actionItems: JSON.parse(s.actionItems),
      decisions: JSON.parse(s.decisions),
    })),
    _meta: {
      originalFileName: fileName,
      fileSize,
      mimeType,
      language,
      simulatedTranscription: true,
      segmentCount: segments.length,
      highlightCount: highlights.length,
    },
  };
}

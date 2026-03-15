import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_RETRIES = 2;
const TIMEOUT_MS = 30000;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

export function isAIAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const minutes = Math.floor(seg.startTime / 60);
      const seconds = Math.round(seg.startTime % 60);
      const timestamp = `${minutes}:${String(seconds).padStart(2, "0")}`;
      return `[${timestamp}] ${seg.speaker}: ${seg.text}`;
    })
    .join("\n");
}

// 1. Generate meeting summary from transcript
export async function generateAISummary(
  transcript: TranscriptSegment[],
  meetingName: string
): Promise<{
  summary: string;
  actionItems: { assignee: string; task: string; deadline?: string }[];
  decisions: { decision: string; context?: string }[];
  keyPoints: string[];
}> {
  const client = getClient();
  if (!client) {
    throw new Error("Anthropic API key not configured");
  }

  const formattedTranscript = formatTranscript(transcript);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are a meeting analysis AI. You analyze meeting transcripts and produce structured summaries. Always respond with valid JSON only, no markdown or extra text.`,
    messages: [
      {
        role: "user",
        content: `Analyze this meeting transcript for "${meetingName}" and return a JSON object with exactly these fields:

{
  "summary": "A concise 2-4 sentence summary of the meeting",
  "actionItems": [{"assignee": "Person Name", "task": "Description of task", "deadline": "optional deadline or null"}],
  "decisions": [{"decision": "What was decided", "context": "Brief context or null"}],
  "keyPoints": ["Key point 1", "Key point 2"]
}

Transcript:
${formattedTranscript}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    return {
      summary: parsed.summary || "",
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch {
    // If JSON parsing fails, return the raw text as summary
    return {
      summary: textBlock.text,
      actionItems: [],
      decisions: [],
      keyPoints: [],
    };
  }
}

// 2. Ask AI about a meeting transcript
export async function askAI(
  question: string,
  transcript: TranscriptSegment[]
): Promise<{
  answer: string;
  relevantTimestamps: number[];
}> {
  const client = getClient();
  if (!client) {
    throw new Error("Anthropic API key not configured");
  }

  const formattedTranscript = formatTranscript(transcript);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a helpful meeting assistant. You answer questions about meeting transcripts accurately and concisely. Always respond with valid JSON only, no markdown or extra text.`,
    messages: [
      {
        role: "user",
        content: `Based on this meeting transcript, answer the following question. Return a JSON object with:

{
  "answer": "Your detailed answer to the question",
  "relevantTimestamps": [list of startTime values in seconds that are relevant to the answer]
}

The timestamps in the transcript are in [minutes:seconds] format. Convert them to total seconds for the relevantTimestamps array.

Question: ${question}

Transcript:
${formattedTranscript}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    return {
      answer: parsed.answer || textBlock.text,
      relevantTimestamps: Array.isArray(parsed.relevantTimestamps)
        ? parsed.relevantTimestamps.filter((t: unknown) => typeof t === "number")
        : [],
    };
  } catch {
    return {
      answer: textBlock.text,
      relevantTimestamps: [],
    };
  }
}

// 3. Generate AI report across multiple meetings
export async function generateAIReport(
  meetings: { name: string; summary: string; date: string }[],
  reportType: string
): Promise<{
  title: string;
  findings: string[];
  recommendations: string[];
  summary: string;
}> {
  const client = getClient();
  if (!client) {
    throw new Error("Anthropic API key not configured");
  }

  const meetingList = meetings
    .map(
      (m, i) =>
        `Meeting ${i + 1}: "${m.name}" (${m.date})\nSummary: ${m.summary}`
    )
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are an executive reporting AI. You analyze multiple meeting summaries and produce insightful cross-meeting reports. Always respond with valid JSON only, no markdown or extra text.`,
    messages: [
      {
        role: "user",
        content: `Generate a "${reportType}" report analyzing these ${meetings.length} meetings. Return a JSON object with:

{
  "title": "Report title",
  "findings": ["Key finding 1", "Key finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "summary": "Executive summary of the report"
}

Meetings:
${meetingList}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    return {
      title: parsed.title || `${reportType} Report`,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      summary: parsed.summary || "",
    };
  } catch {
    return {
      title: `${reportType} Report`,
      findings: [],
      recommendations: [],
      summary: textBlock.text,
    };
  }
}

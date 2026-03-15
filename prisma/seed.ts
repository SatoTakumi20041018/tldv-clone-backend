import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.topic.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.highlight.deleteMany();
  await prisma.aISummary.deleteMany();
  await prisma.transcript.deleteMany();
  await prisma.meetingInvitee.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  // Create test user
  const hashedPassword = await bcrypt.hash("password123", 10);
  const testUser = await prisma.user.create({
    data: {
      email: "test@tldv.io",
      name: "Test User",
      password: hashedPassword,
      role: "admin",
      apiKey: `tldv_${randomBytes(32).toString("hex")}`,
    },
  });
  console.log(`Created user: ${testUser.email} (API key: ${testUser.apiKey})`);

  // Create second user
  const secondUser = await prisma.user.create({
    data: {
      email: "jane@tldv.io",
      name: "Jane Smith",
      password: hashedPassword,
      role: "user",
    },
  });
  console.log(`Created user: ${secondUser.email}`);

  // Create team
  const team = await prisma.team.create({
    data: {
      name: "Engineering Team",
    },
  });
  console.log(`Created team: ${team.name}`);

  // Add members to team
  await prisma.teamMember.create({
    data: {
      userId: testUser.id,
      teamId: team.id,
      role: "owner",
    },
  });
  await prisma.teamMember.create({
    data: {
      userId: secondUser.id,
      teamId: team.id,
      role: "member",
    },
  });
  console.log("Added team members");

  // Meeting 1: Sprint Planning with transcript and highlights
  const meeting1 = await prisma.meeting.create({
    data: {
      name: "Sprint Planning - Q1 2026",
      happenedAt: new Date("2026-03-10T09:00:00Z"),
      duration: 3600,
      url: "https://meet.google.com/abc-defg-hij",
      recordingUrl: "https://storage.example.com/recordings/sprint-planning.mp4",
      status: "ready",
      organizerId: testUser.id,
      teamId: team.id,
      conferenceType: "meet",
      conferenceId: "abc-defg-hij",
    },
  });

  await prisma.meetingInvitee.createMany({
    data: [
      { meetingId: meeting1.id, name: "Jane Smith", email: "jane@tldv.io" },
      { meetingId: meeting1.id, name: "Bob Wilson", email: "bob@tldv.io" },
      { meetingId: meeting1.id, name: "Alice Chen", email: "alice@tldv.io" },
    ],
  });

  const transcript1 = await prisma.transcript.create({
    data: {
      meetingId: meeting1.id,
    },
  });

  await prisma.transcriptSegment.createMany({
    data: [
      {
        transcriptId: transcript1.id,
        speaker: "Test User",
        text: "Good morning everyone. Let's kick off our sprint planning for Q1 2026. We have a lot to cover today.",
        startTime: 0,
        endTime: 8.5,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Jane Smith",
        text: "Thanks for organizing this. I've prepared the backlog items we need to discuss. There are about 15 stories ready for estimation.",
        startTime: 9.0,
        endTime: 17.2,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Bob Wilson",
        text: "Before we start, I want to flag that the authentication service migration should be our top priority. We decided last week to tackle that first.",
        startTime: 18.0,
        endTime: 28.5,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Alice Chen",
        text: "Agreed. I've been researching the new OAuth 2.1 specification and I think we should adopt it for the migration. It will save us work later.",
        startTime: 29.0,
        endTime: 40.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Test User",
        text: "Good point Alice. Let's estimate that story first. Bob, you mentioned it needs about two weeks. Can you break it down?",
        startTime: 41.0,
        endTime: 50.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Bob Wilson",
        text: "Sure. I will prepare the detailed breakdown by end of day. The main components are: token service refactor, user session management, and backwards compatibility layer.",
        startTime: 51.0,
        endTime: 63.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Jane Smith",
        text: "We should also plan for the dashboard redesign. Marketing confirmed the new designs are approved. I need to coordinate with the frontend team.",
        startTime: 64.0,
        endTime: 75.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Test User",
        text: "Let's allocate three story points for the dashboard. Jane, you will lead the frontend implementation. Alice, can you handle the API changes needed?",
        startTime: 76.0,
        endTime: 88.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Alice Chen",
        text: "Yes, I will start on the API changes once the auth migration is complete. I think we need to update five endpoints total.",
        startTime: 89.0,
        endTime: 98.0,
      },
      {
        transcriptId: transcript1.id,
        speaker: "Test User",
        text: "Perfect. To summarize: auth migration is top priority, then dashboard redesign. Bob handles the breakdown, Jane leads frontend, Alice does APIs. Let's reconvene Wednesday for a progress check.",
        startTime: 99.0,
        endTime: 115.0,
      },
    ],
  });

  const highlight1 = await prisma.highlight.create({
    data: {
      meetingId: meeting1.id,
      text: "Authentication service migration is top priority. Adopting OAuth 2.1 specification.",
      startTime: 18.0,
      source: "ai",
      topics: {
        create: [
          {
            title: "Auth Migration Priority",
            summary:
              "Team agreed that the authentication service migration using OAuth 2.1 should be the top priority for the sprint.",
          },
        ],
      },
    },
  });

  await prisma.highlight.create({
    data: {
      meetingId: meeting1.id,
      text: "Dashboard redesign approved by marketing. Three story points allocated.",
      startTime: 64.0,
      source: "ai",
      topics: {
        create: [
          {
            title: "Dashboard Redesign",
            summary:
              "Marketing approved the new dashboard designs. Estimated at three story points with Jane leading frontend and Alice handling API changes.",
          },
        ],
      },
    },
  });

  await prisma.highlight.create({
    data: {
      meetingId: meeting1.id,
      text: "Bob will prepare detailed breakdown of auth migration by end of day.",
      startTime: 51.0,
      source: "manual",
    },
  });

  await prisma.aISummary.create({
    data: {
      meetingId: meeting1.id,
      summary:
        'The Sprint Planning meeting for Q1 2026 focused on prioritizing the authentication service migration to OAuth 2.1, led by Bob Wilson with support from Alice Chen. The team also discussed the marketing-approved dashboard redesign, allocating three story points with Jane Smith leading frontend implementation and Alice handling API modifications. Key decisions included making the auth migration the top priority and scheduling a Wednesday progress check.',
      actionItems: JSON.stringify([
        {
          assignee: "Bob Wilson",
          task: "Prepare detailed breakdown of auth migration components",
          deadline: "End of day",
        },
        {
          assignee: "Jane Smith",
          task: "Lead frontend implementation of dashboard redesign",
        },
        {
          assignee: "Alice Chen",
          task: "Handle API changes for dashboard (5 endpoints) after auth migration",
        },
        {
          assignee: "Test User",
          task: "Schedule Wednesday progress check meeting",
        },
      ]),
      decisions: JSON.stringify([
        {
          decision: "Auth service migration is top priority for the sprint",
          context: "Agreed by full team",
        },
        {
          decision: "Adopt OAuth 2.1 specification for the migration",
          context: "Proposed by Alice Chen, approved by team",
        },
        {
          decision: "Dashboard redesign estimated at three story points",
          context: "Based on approved marketing designs",
        },
      ]),
      template: "default",
    },
  });

  console.log(`Created meeting: ${meeting1.name} (with transcript, highlights, and summary)`);

  // Meeting 2: Client Demo (external meeting)
  const meeting2 = await prisma.meeting.create({
    data: {
      name: "Product Demo - Acme Corp",
      happenedAt: new Date("2026-03-12T14:00:00Z"),
      duration: 2700,
      url: "https://zoom.us/j/123456789",
      recordingUrl: "https://storage.example.com/recordings/acme-demo.mp4",
      status: "ready",
      organizerId: testUser.id,
      teamId: team.id,
      conferenceType: "zoom",
      conferenceId: "123456789",
    },
  });

  await prisma.meetingInvitee.createMany({
    data: [
      { meetingId: meeting2.id, name: "Sarah Johnson", email: "sarah@acmecorp.com" },
      { meetingId: meeting2.id, name: "Mike Davis", email: "mike@acmecorp.com" },
    ],
  });

  const transcript2 = await prisma.transcript.create({
    data: {
      meetingId: meeting2.id,
    },
  });

  await prisma.transcriptSegment.createMany({
    data: [
      {
        transcriptId: transcript2.id,
        speaker: "Test User",
        text: "Welcome Sarah and Mike. Thanks for taking the time to see our product demo today. I'm excited to show you what we've built.",
        startTime: 0,
        endTime: 10.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Sarah Johnson",
        text: "We've been looking forward to this. Our team has been evaluating several solutions for meeting productivity. Can you show us the transcription feature first?",
        startTime: 11.0,
        endTime: 22.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Test User",
        text: "Absolutely. Let me share my screen. As you can see, the transcription happens in real-time with speaker identification. We support over 30 languages.",
        startTime: 23.0,
        endTime: 35.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Mike Davis",
        text: "That's impressive. What about the accuracy? We've had issues with other tools misidentifying speakers, especially in larger meetings.",
        startTime: 36.0,
        endTime: 46.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Test User",
        text: "Great question. Our speaker identification accuracy is above 95% for meetings with up to 10 participants. We also allow manual corrections that improve the model over time.",
        startTime: 47.0,
        endTime: 60.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Sarah Johnson",
        text: "And the AI summary feature? That's what really caught our attention. Can it integrate with our Salesforce instance?",
        startTime: 61.0,
        endTime: 72.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Test User",
        text: "Yes, we have a native Salesforce integration. After each meeting, the AI generates a summary with action items and key decisions, and it can automatically push those to your Salesforce records.",
        startTime: 73.0,
        endTime: 88.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Mike Davis",
        text: "What's the pricing for a team of about 50 people? We need to present this to our procurement team.",
        startTime: 89.0,
        endTime: 98.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Test User",
        text: "For a team of 50, our Business plan would be the best fit. I will send you a detailed proposal with pricing by Friday. We also offer a 14-day free trial.",
        startTime: 99.0,
        endTime: 112.0,
      },
      {
        transcriptId: transcript2.id,
        speaker: "Sarah Johnson",
        text: "That sounds good. We'd like to start the trial next week if possible. Can you set that up for us?",
        startTime: 113.0,
        endTime: 122.0,
      },
    ],
  });

  await prisma.highlight.create({
    data: {
      meetingId: meeting2.id,
      text: "Acme Corp interested in Salesforce integration and AI summaries. Team of 50 users.",
      startTime: 61.0,
      source: "ai",
      topics: {
        create: [
          {
            title: "Salesforce Integration Interest",
            summary:
              "Client specifically asked about Salesforce integration for AI summaries and action items auto-push.",
          },
          {
            title: "Team Size and Pricing",
            summary:
              "Acme Corp has a team of 50 people. Business plan recommended. Pricing proposal to be sent by Friday.",
          },
        ],
      },
    },
  });

  await prisma.highlight.create({
    data: {
      meetingId: meeting2.id,
      text: "Client wants to start 14-day free trial next week.",
      startTime: 113.0,
      source: "manual",
    },
  });

  console.log(`Created meeting: ${meeting2.name} (with transcript and highlights)`);

  // Meeting 3: Internal standup (no external invitees)
  const meeting3 = await prisma.meeting.create({
    data: {
      name: "Daily Standup - March 14",
      happenedAt: new Date("2026-03-14T09:30:00Z"),
      duration: 900,
      url: "https://teams.microsoft.com/l/meetup-join/abc",
      status: "ready",
      organizerId: testUser.id,
      teamId: team.id,
      conferenceType: "teams",
      conferenceId: "standup-daily-abc",
    },
  });

  const transcript3 = await prisma.transcript.create({
    data: {
      meetingId: meeting3.id,
    },
  });

  await prisma.transcriptSegment.createMany({
    data: [
      {
        transcriptId: transcript3.id,
        speaker: "Test User",
        text: "Good morning team. Let's do a quick round. Jane, what's your update?",
        startTime: 0,
        endTime: 6.0,
      },
      {
        transcriptId: transcript3.id,
        speaker: "Jane Smith",
        text: "Yesterday I finished the header component for the dashboard redesign. Today I'm going to work on the sidebar navigation. No blockers.",
        startTime: 7.0,
        endTime: 18.0,
      },
      {
        transcriptId: transcript3.id,
        speaker: "Test User",
        text: "Great progress. Bob?",
        startTime: 19.0,
        endTime: 21.0,
      },
      {
        transcriptId: transcript3.id,
        speaker: "Bob Wilson",
        text: "I completed the token service refactor for the auth migration. Currently working on the session management piece. I need Alice to review my PR when she gets a chance.",
        startTime: 22.0,
        endTime: 35.0,
      },
      {
        transcriptId: transcript3.id,
        speaker: "Alice Chen",
        text: "I'll review it right after this standup. My update: I started on the API endpoint changes yesterday. Two of five endpoints are done. Should finish the rest by tomorrow.",
        startTime: 36.0,
        endTime: 50.0,
      },
    ],
  });

  console.log(`Created meeting: ${meeting3.name} (internal, with transcript)`);

  // Meeting 4: Pending meeting (future)
  const meeting4 = await prisma.meeting.create({
    data: {
      name: "Architecture Review - Microservices",
      happenedAt: new Date("2026-03-20T11:00:00Z"),
      duration: 5400,
      url: "https://meet.google.com/xyz-uvwx-rst",
      status: "pending",
      organizerId: testUser.id,
      teamId: team.id,
      conferenceType: "meet",
      conferenceId: "xyz-uvwx-rst",
    },
  });

  await prisma.meetingInvitee.createMany({
    data: [
      { meetingId: meeting4.id, name: "Jane Smith", email: "jane@tldv.io" },
      { meetingId: meeting4.id, name: "Bob Wilson", email: "bob@tldv.io" },
      { meetingId: meeting4.id, name: "Alice Chen", email: "alice@tldv.io" },
      { meetingId: meeting4.id, name: "Dave Kumar", email: "dave@tldv.io" },
    ],
  });

  console.log(`Created meeting: ${meeting4.name} (pending, future)`);

  // Create a webhook for the test user
  await prisma.webhook.create({
    data: {
      userId: testUser.id,
      teamId: team.id,
      url: "https://webhook.site/test-endpoint",
      events: JSON.stringify(["MeetingReady", "TranscriptReady", "SummaryGenerated"]),
      active: true,
    },
  });
  console.log("Created sample webhook");

  // Create an integration
  await prisma.integration.create({
    data: {
      userId: testUser.id,
      type: "slack",
      config: JSON.stringify({
        workspace: "engineering-team",
        channel: "#meeting-notes",
        notifyOnSummary: true,
      }),
      active: true,
    },
  });
  console.log("Created sample Slack integration");

  console.log("\n--- Seed Complete ---");
  console.log(`Test user email: test@tldv.io`);
  console.log(`Test user password: password123`);
  console.log(`Test user API key: ${testUser.apiKey}`);
  console.log(`Total meetings: 4`);
  console.log(`Meetings with transcripts: 3`);
  console.log(`Meetings with highlights: 2`);
  console.log(`Meetings with AI summaries: 1`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

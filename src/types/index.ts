import { Request } from "express";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface MeetingFilterQuery extends PaginationQuery {
  meetingType?: "internal" | "external";
  status?: string;
  conferenceType?: string;
  from?: string;
  to?: string;
}

export interface WebhookPayload {
  id: string;
  event: string;
  data: Record<string, unknown>;
  executedAt: string;
}

export interface ValidationError {
  property: string;
  constraints: Record<string, string>;
}

export interface ApiError {
  name: string;
  message: string;
  errors?: ValidationError[];
}

export type ConferenceType = "zoom" | "meet" | "teams";

export type MeetingStatus = "pending" | "recording" | "processing" | "ready" | "error";

export type HighlightSource = "manual" | "ai";

export type IntegrationType = "hubspot" | "salesforce" | "slack" | "notion" | "zapier";

export type WebhookEvent = "MeetingReady" | "TranscriptReady" | "HighlightCreated" | "SummaryGenerated";

export type TeamRole = "owner" | "admin" | "member";

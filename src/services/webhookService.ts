import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";

export interface CreateWebhookData {
  url: string;
  events: string[];
  teamId?: string;
  active?: boolean;
}

export interface UpdateWebhookData {
  url?: string;
  events?: string[];
  active?: boolean;
}

export async function listWebhooks(userId: string) {
  const webhooks = await prisma.webhook.findMany({
    where: { userId },
    include: {
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return webhooks.map((w) => ({
    ...w,
    events: JSON.parse(w.events),
  }));
}

export async function getWebhookById(webhookId: string, userId: string) {
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, userId },
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  if (!webhook) {
    throw new NotFoundError("Webhook not found");
  }

  return {
    ...webhook,
    events: JSON.parse(webhook.events),
  };
}

export async function createWebhook(data: CreateWebhookData, userId: string) {
  if (data.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: data.teamId },
      },
    });
    if (!membership) {
      throw new NotFoundError("Team not found or you are not a member");
    }
  }

  const webhook = await prisma.webhook.create({
    data: {
      userId,
      teamId: data.teamId,
      url: data.url,
      events: JSON.stringify(data.events),
      active: data.active !== undefined ? data.active : true,
    },
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  return {
    ...webhook,
    events: JSON.parse(webhook.events),
  };
}

export async function updateWebhook(
  webhookId: string,
  data: UpdateWebhookData,
  userId: string
) {
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, userId },
  });

  if (!webhook) {
    throw new NotFoundError("Webhook not found");
  }

  const updateData: Record<string, unknown> = {};
  if (data.url !== undefined) updateData.url = data.url;
  if (data.events !== undefined) updateData.events = JSON.stringify(data.events);
  if (data.active !== undefined) updateData.active = data.active;

  const updated = await prisma.webhook.update({
    where: { id: webhookId },
    data: updateData,
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  return {
    ...updated,
    events: JSON.parse(updated.events),
  };
}

export async function deleteWebhook(webhookId: string, userId: string) {
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, userId },
  });

  if (!webhook) {
    throw new NotFoundError("Webhook not found");
  }

  await prisma.webhook.delete({ where: { id: webhookId } });

  return { message: "Webhook deleted successfully" };
}

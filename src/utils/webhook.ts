import { v4 as uuidv4 } from "uuid";
import prisma from "./prisma";
import { WebhookPayload } from "../types";

export async function fireWebhookEvent(
  event: string,
  data: Record<string, unknown>,
  userId: string,
  teamId?: string | null
): Promise<void> {
  const whereClause: Record<string, unknown> = {
    active: true,
    userId,
  };

  const webhooks = await prisma.webhook.findMany({
    where: whereClause,
  });

  const matchingWebhooks = webhooks.filter((webhook) => {
    const events: string[] = JSON.parse(webhook.events);
    return events.includes(event);
  });

  if (teamId) {
    const teamWebhooks = await prisma.webhook.findMany({
      where: {
        active: true,
        teamId,
      },
    });
    const matchingTeamWebhooks = teamWebhooks.filter((webhook) => {
      const events: string[] = JSON.parse(webhook.events);
      return events.includes(event);
    });
    matchingWebhooks.push(...matchingTeamWebhooks);
  }

  const uniqueWebhooks = Array.from(
    new Map(matchingWebhooks.map((w) => [w.id, w])).values()
  );

  const payload: WebhookPayload = {
    id: uuidv4(),
    event,
    data,
    executedAt: new Date().toISOString(),
  };

  const deliveryPromises = uniqueWebhooks.map(async (webhook) => {
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Id": payload.id,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      console.log(
        `Webhook delivered to ${webhook.url}: ${response.status}`
      );
    } catch (error) {
      console.error(
        `Failed to deliver webhook to ${webhook.url}:`,
        error instanceof Error ? error.message : error
      );
    }
  });

  await Promise.allSettled(deliveryPromises);
}

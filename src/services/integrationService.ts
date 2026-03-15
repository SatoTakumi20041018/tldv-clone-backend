import prisma from "../utils/prisma";
import { NotFoundError } from "../middleware/errorHandler";

export interface CreateIntegrationData {
  type: string;
  config?: Record<string, unknown>;
  active?: boolean;
}

export interface UpdateIntegrationData {
  config?: Record<string, unknown>;
  active?: boolean;
}

export async function listIntegrations(userId: string) {
  const integrations = await prisma.integration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return integrations.map((i) => ({
    ...i,
    config: JSON.parse(i.config),
  }));
}

export async function getIntegrationById(integrationId: string, userId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new NotFoundError("Integration not found");
  }

  return {
    ...integration,
    config: JSON.parse(integration.config),
  };
}

export async function createIntegration(
  data: CreateIntegrationData,
  userId: string
) {
  const existing = await prisma.integration.findFirst({
    where: { userId, type: data.type },
  });

  if (existing) {
    const updated = await prisma.integration.update({
      where: { id: existing.id },
      data: {
        config: data.config ? JSON.stringify(data.config) : existing.config,
        active: data.active !== undefined ? data.active : existing.active,
      },
    });

    return {
      ...updated,
      config: JSON.parse(updated.config),
    };
  }

  const integration = await prisma.integration.create({
    data: {
      userId,
      type: data.type,
      config: data.config ? JSON.stringify(data.config) : "{}",
      active: data.active !== undefined ? data.active : true,
    },
  });

  return {
    ...integration,
    config: JSON.parse(integration.config),
  };
}

export async function updateIntegration(
  integrationId: string,
  data: UpdateIntegrationData,
  userId: string
) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new NotFoundError("Integration not found");
  }

  const updateData: Record<string, unknown> = {};
  if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
  if (data.active !== undefined) updateData.active = data.active;

  const updated = await prisma.integration.update({
    where: { id: integrationId },
    data: updateData,
  });

  return {
    ...updated,
    config: JSON.parse(updated.config),
  };
}

export async function deleteIntegration(
  integrationId: string,
  userId: string
) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new NotFoundError("Integration not found");
  }

  await prisma.integration.delete({ where: { id: integrationId } });

  return { message: "Integration deleted successfully" };
}

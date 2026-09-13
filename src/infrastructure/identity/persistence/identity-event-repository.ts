import type { PrismaClient } from "../../../generated/prisma/client";
import type { IdentityEvent } from "../../../domain/identity/events/identity-events";

export class IdentityEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(event: IdentityEvent): Promise<void> {
    await (this.prisma.identityEvent as any).create({
      data: {
        id: event.eventId,
        orgId: event.organizationId,
        actorUserId: event.actorUserId,
        subjectUserId: event.subjectUserId,
        eventType: event.eventType.replace(/\./g, "_") as any, // account.registered -> account_registered
        objectType: event.objectType,
        objectId: event.objectId,
        payload: event.data as any,
        occurredAt: new Date(event.occurredAt),
        sequence: BigInt(event.sequence),
      },
    });
  }

  async createMany(events: IdentityEvent[]): Promise<void> {
    if (events.length === 0) return;
    const data = events.map((e) => ({
      id: e.eventId,
      orgId: e.organizationId,
      actorUserId: e.actorUserId,
      subjectUserId: e.subjectUserId,
      eventType: e.eventType.replace(/\./g, "_") as any,
      objectType: e.objectType,
      objectId: e.objectId,
      payload: e.data as any,
      occurredAt: new Date(e.occurredAt),
      sequence: BigInt(e.sequence),
    }));
    await (this.prisma.identityEvent as any).createMany({ data });
  }

  async findByOrgId(orgId: string, params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    return (this.prisma.identityEvent as any).findMany({
      where: { orgId },
      orderBy: [{ sequence: "asc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  async findBySubjectUserId(subjectUserId: string) {
    return (this.prisma.identityEvent as any).findMany({
      where: { subjectUserId },
      orderBy: { occurredAt: "asc" },
    });
  }
}

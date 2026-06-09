import { Injectable } from '@nestjs/common';
import { OutboxRecord, OutboxStore } from '@lingua/kafka';
import { PrismaService } from '../prisma/prisma.service';

/** {@link OutboxStore} backed by svc-learning's Prisma `outbox` table. */
@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({ id: r.id, topic: r.topic, key: r.key, payload: r.payload }));
  }

  async markPublished(ids: string[]): Promise<void> {
    await this.prisma.outbox.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: new Date() },
    });
  }
}

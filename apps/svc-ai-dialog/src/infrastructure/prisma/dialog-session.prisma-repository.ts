import { Injectable } from '@nestjs/common';
import { traceHeaders } from '@lingua/observability';
import {
  AppendTurnInput,
  DialogSessionRepository,
  DialogTurnHistory,
} from '../../domain/ports/dialog-session.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDialogSessionRepository implements DialogSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async history(sessionId: string): Promise<DialogTurnHistory[]> {
    const rows = await this.prisma.dialogTurn.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ userText: r.userText, aiText: r.aiText }));
  }

  async appendTurn(input: AppendTurnInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.dialogSession.upsert({
        where: { id: input.sessionId },
        create: {
          id: input.sessionId,
          userId: input.userId,
          scenario: input.scenario,
        },
        update: {},
      });
      await tx.dialogTurn.create({
        data: {
          sessionId: input.sessionId,
          userId: input.userId,
          userText: input.userText,
          aiText: input.aiText,
        },
      });
      if (input.event) {
        await tx.outbox.create({
          data: {
            topic: input.event.type,
            key: input.event.payload.userId,
            payload: input.event as unknown as object,
            headers: traceHeaders(),
          },
        });
      }
    });
  }
}

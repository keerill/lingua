import { OutboxRelay, OutboxRecord, OutboxStore } from './outbox';
import type { KafkaProducer } from './producer';

/** In-memory outbox store for testing the relay in isolation. */
class FakeStore implements OutboxStore {
  constructor(public rows: OutboxRecord[]) {}
  published: string[] = [];

  async fetchUnpublished(limit: number): Promise<OutboxRecord[]> {
    return this.rows.filter((r) => !this.published.includes(r.id)).slice(0, limit);
  }
  async markPublished(ids: string[]): Promise<void> {
    this.published.push(...ids);
  }
}

const silentLogger = { log: () => undefined, error: () => undefined };

function makeRows(n: number): OutboxRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row-${i}`,
    topic: 'vocabulary.card.created',
    key: `card-${i}`,
    payload: { eventId: `e-${i}`, n: i },
  }));
}

describe('OutboxRelay', () => {
  it('publishes all unpublished rows and marks them published', async () => {
    const store = new FakeStore(makeRows(3));
    const send = jest.fn().mockResolvedValue(undefined);
    const relay = new OutboxRelay(store, { send } as unknown as KafkaProducer, {
      logger: silentLogger,
    });

    const count = await relay.drainOnce();

    expect(count).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledWith({
      topic: 'vocabulary.card.created',
      key: 'card-0',
      value: { eventId: 'e-0', n: 0 },
    });
    expect(store.published).toEqual(['row-0', 'row-1', 'row-2']);
  });

  it('no-ops on an empty outbox', async () => {
    const store = new FakeStore([]);
    const send = jest.fn();
    const relay = new OutboxRelay(store, { send } as unknown as KafkaProducer, {
      logger: silentLogger,
    });

    expect(await relay.drainOnce()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('stops at the first publish failure and leaves remaining rows for retry', async () => {
    const store = new FakeStore(makeRows(3));
    const send = jest
      .fn()
      .mockResolvedValueOnce(undefined) // row-0 ok
      .mockRejectedValueOnce(new Error('broker down')); // row-1 fails
    const relay = new OutboxRelay(store, { send } as unknown as KafkaProducer, {
      logger: silentLogger,
    });

    const count = await relay.drainOnce();

    expect(count).toBe(1); // only row-0 published & marked
    expect(store.published).toEqual(['row-0']);

    // a subsequent successful drain picks up the rest (at-least-once retry)
    send.mockResolvedValue(undefined);
    const count2 = await relay.drainOnce();
    expect(count2).toBe(2);
    expect(store.published).toEqual(['row-0', 'row-1', 'row-2']);
  });

  it('respects the batch size', async () => {
    const store = new FakeStore(makeRows(10));
    const send = jest.fn().mockResolvedValue(undefined);
    const relay = new OutboxRelay(store, { send } as unknown as KafkaProducer, {
      batchSize: 4,
      logger: silentLogger,
    });

    expect(await relay.drainOnce()).toBe(4);
    expect(store.published).toHaveLength(4);
  });
});

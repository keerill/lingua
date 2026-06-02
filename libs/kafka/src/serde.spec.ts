import { jsonSerde, type KafkaSerde } from './serde';

const underlyingSend = jest.fn().mockResolvedValue(undefined);
jest.mock('./client', () => ({
  createKafka: () => ({
    producer: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      send: underlyingSend,
      disconnect: jest.fn().mockResolvedValue(undefined),
    }),
  }),
}));

import { KafkaProducer } from './producer';

describe('jsonSerde (default wire format)', () => {
  it('round-trips an event envelope through UTF-8 JSON bytes', async () => {
    const envelope = {
      eventId: 'e-1',
      type: 'learning.review.completed',
      occurredAt: '2026-06-10T00:00:00.000Z',
      payload: { userId: 'u1', cardId: 'c1', grade: 3 },
    };

    const bytes = await jsonSerde.serialize(
      'learning.review.completed',
      envelope,
    );

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.toString('utf8')).toBe(JSON.stringify(envelope));
    expect(await jsonSerde.deserialize('t', bytes)).toEqual(envelope);
  });

  it('deserializes empty bytes to null', async () => {
    expect(await jsonSerde.deserialize('t', Buffer.alloc(0))).toBeNull();
  });
});

describe('KafkaProducer serde seam', () => {
  beforeEach(() => underlyingSend.mockClear());

  it('serializes the value through the injected serde and forwards the bytes', async () => {
    const fakeSerde: KafkaSerde = {
      serialize: jest.fn().mockResolvedValue(Buffer.from('ENCODED')),
      deserialize: jest.fn(),
    };
    const producer = new KafkaProducer(
      { brokers: 'localhost:9092', clientId: 'test' },
      fakeSerde,
    );
    await producer.connect();

    await producer.send({
      topic: 't',
      key: 'k',
      value: { a: 1 },
      headers: { h: '1' },
    });

    expect(fakeSerde.serialize).toHaveBeenCalledWith('t', { a: 1 });
    expect(underlyingSend).toHaveBeenCalledWith({
      topic: 't',
      messages: [
        { key: 'k', value: Buffer.from('ENCODED'), headers: { h: '1' } },
      ],
    });
  });

  it('defaults to JSON when no serde is supplied', async () => {
    const producer = new KafkaProducer({
      brokers: 'localhost:9092',
      clientId: 'test',
    });
    await producer.connect();

    await producer.send({ topic: 't', key: 'k', value: { a: 1 } });

    const sent = underlyingSend.mock.calls.at(-1)?.[0];
    expect(sent.messages[0].value.toString('utf8')).toBe(
      JSON.stringify({ a: 1 }),
    );
  });
});

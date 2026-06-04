import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { KEYCLOAK_VERIFIER } from '@lingua/auth';
import type {
  Card,
  CreateCardDto,
  CreateDeckDto,
  Deck,
  ReviewGrade,
} from '@lingua/contracts';
import { GatewayModule } from '../../gateway-bff/src/gateway.module';
import { VOCABULARY_PORT } from '../../gateway-bff/src/application/ports/vocabulary.port';
import { LEARNING_PORT } from '../../gateway-bff/src/application/ports/learning.port';
import { IDENTITY_PORT } from '../../gateway-bff/src/application/ports/identity.port';

const TEST_USER = {
  sub: 'user-e2e',
  email: 'e2e@lingua.dev',
  displayName: 'E2E',
  roles: ['learner'],
};

class FakeVocabulary {
  decks: Deck[] = [];
  cards: Card[] = [];
  private seq = 0;
  createDeck(ownerId: string, dto: CreateDeckDto): Promise<Deck> {
    const deck: Deck = {
      id: `deck-${++this.seq}`,
      ownerId,
      title: dto.title,
      langFrom: dto.langFrom,
      langTo: dto.langTo,
      createdAt: new Date().toISOString(),
    };
    this.decks.push(deck);
    return Promise.resolve(deck);
  }
  listDecks(ownerId: string): Promise<Deck[]> {
    return Promise.resolve(this.decks.filter((d) => d.ownerId === ownerId));
  }
  createCard(
    _ownerId: string,
    deckId: string,
    dto: CreateCardDto,
  ): Promise<Card> {
    const card: Card = {
      id: `card-${++this.seq}`,
      deckId,
      term: dto.term,
      translation: dto.translation,
      example: dto.example ?? null,
      createdAt: new Date().toISOString(),
    };
    this.cards.push(card);
    return Promise.resolve(card);
  }
  getCards(_ownerId: string, ids: string[]): Promise<Card[]> {
    return Promise.resolve(this.cards.filter((c) => ids.includes(c.id)));
  }
}

class FakeLearning {
  constructor(private readonly vocab: FakeVocabulary) {}
  reviewed = new Set<string>();
  getQueue(userId: string, limit: number) {
    void userId;
    return Promise.resolve(
      this.vocab.cards
        .filter((c) => !this.reviewed.has(c.id))
        .slice(0, limit)
        .map((c) => ({
          cardId: c.id,
          due: new Date().toISOString(),
          state: 'New',
          reps: 0,
          lapses: 0,
        })),
    );
  }
  submitReview(_userId: string, cardId: string, grade: ReviewGrade) {
    this.reviewed.add(cardId);
    return Promise.resolve({
      cardId,
      due: new Date(Date.now() + 86_400_000).toISOString(),
      stability: 1 + grade,
      difficulty: 5,
      state: 'Review' as const,
      reps: 1,
      lapses: grade === 1 ? 1 : 0,
      lastReview: new Date().toISOString(),
    });
  }
}

describe('BFF main flow (e2e)', () => {
  let app: INestApplication;
  const vocab = new FakeVocabulary();
  const learning = new FakeLearning(vocab);
  const identity = {
    sync: jest
      .fn()
      .mockResolvedValue({ ...TEST_USER, id: TEST_USER.sub, createdAt: '' }),
  };
  const TOKEN = 'test-token';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GatewayModule],
    })
      .overrideProvider(KEYCLOAK_VERIFIER)
      .useValue({
        verify: (t: string) =>
          t === TOKEN
            ? Promise.resolve(TEST_USER)
            : Promise.reject(new Error('bad token')),
      })
      .overrideProvider(VOCABULARY_PORT)
      .useValue(vocab)
      .overrideProvider(LEARNING_PORT)
      .useValue(learning)
      .overrideProvider(IDENTITY_PORT)
      .useValue(identity)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${TOKEN}`);

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/decks').expect(401);
  });

  it('runs the full create → review flow through the BFF', async () => {
    const deckRes = await auth(
      request(app.getHttpServer())
        .post('/decks')
        .send({ title: 'Verbs', langFrom: 'en', langTo: 'ru' }),
    ).expect(201);
    const deckId = deckRes.body.id;
    expect(deckId).toBeDefined();

    const list = await auth(request(app.getHttpServer()).get('/decks')).expect(
      200,
    );
    expect(list.body).toHaveLength(1);

    const cardRes = await auth(
      request(app.getHttpServer())
        .post(`/decks/${deckId}/cards`)
        .send({ term: 'run', translation: 'бежать', example: 'I run.' }),
    ).expect(201);
    const cardId = cardRes.body.id;

    const queue = await auth(
      request(app.getHttpServer()).get('/reviews/queue?limit=20'),
    ).expect(200);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({
      cardId,
      term: 'run',
      translation: 'бежать',
    });

    const review = await auth(
      request(app.getHttpServer())
        .post(`/reviews/${cardId}`)
        .send({ grade: 3 }),
    ).expect(201);
    expect(new Date(review.body.due).getTime()).toBeGreaterThan(Date.now());

    const after = await auth(
      request(app.getHttpServer()).get('/reviews/queue'),
    ).expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('validates the review grade', async () => {
    await auth(
      request(app.getHttpServer())
        .post('/reviews/some-card')
        .send({ grade: 9 }),
    ).expect(400);
  });
});

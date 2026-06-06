import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const BASE =
  'You are a patient English conversation partner helping a learner practise. ' +
  'Keep replies short (1-3 sentences), ask one follow-up question to keep the ' +
  'conversation going, and speak naturally. Do not lecture about grammar.';

const scenarios = [
  {
    slug: 'interview',
    title: 'Job interview',
    description: 'Practise answering questions in a job interview.',
    level: 'B1',
    systemPrompt: `${BASE} Role: a friendly hiring manager interviewing the learner for a job.`,
  },
  {
    slug: 'airport',
    title: 'At the airport',
    description: 'Check in, ask for directions, handle travel problems.',
    level: 'A2',
    systemPrompt: `${BASE} Role: an airport agent helping the learner check in and find their gate.`,
  },
  {
    slug: 'restaurant',
    title: 'At a restaurant',
    description: 'Order food, ask about the menu, pay the bill.',
    level: 'A2',
    systemPrompt: `${BASE} Role: a waiter at a restaurant taking the learner's order.`,
  },
  {
    slug: 'small_talk',
    title: 'Small talk',
    description: 'Casual everyday conversation.',
    level: 'A1',
    systemPrompt: `${BASE} Role: a friendly acquaintance making small talk with the learner.`,
  },
  {
    slug: 'work_call',
    title: 'Work call',
    description: 'A short work video call / stand-up.',
    level: 'B2',
    systemPrompt: `${BASE} Role: a colleague on a work video call discussing project updates.`,
  },
];

const lessons = [
  {
    slug: 'present-perfect-basics',
    title: 'Present Perfect: the basics',
    summary: 'When to use "have done" vs "did" — with everyday examples.',
    level: 'B1',
    order: 1,
    contentMarkdown:
      '# Present Perfect\n\nUse the present perfect for past actions with a present result: ' +
      '"I **have lost** my keys" (I cannot get in now).\n\nUse the past simple for finished ' +
      'time: "I **lost** my keys yesterday".',
  },
  {
    slug: 'travel-vocabulary',
    title: 'Travel vocabulary you actually need',
    summary: 'Words and phrases for airports, hotels and getting around.',
    level: 'A2',
    order: 2,
    contentMarkdown:
      '# Travel vocabulary\n\n- **boarding pass** — the ticket you show at the gate\n' +
      '- **aisle / window seat** — where you sit\n- **check in** — register for your flight',
  },
];

const deckTemplate = {
  slug: 'starter-travel',
  title: 'Starter: Travel',
  description: 'A handful of high-frequency travel words to kick off a deck.',
  level: 'A2',
  cards: [
    {
      term: 'flight',
      translation: 'рейс',
      example: 'My flight leaves at 6pm.',
    },
    { term: 'luggage', translation: 'багаж', example: 'I lost my luggage.' },
    {
      term: 'gate',
      translation: 'выход на посадку',
      example: 'The gate is closing.',
    },
  ],
};

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_CONTENT;
  if (!connectionString) throw new Error('DATABASE_URL_CONTENT is not set');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const s of scenarios) {
      await prisma.scenario.upsert({
        where: { slug: s.slug },
        update: {
          title: s.title,
          description: s.description,
          systemPrompt: s.systemPrompt,
          level: s.level,
          published: true,
        },
        create: { id: randomUUID(), ...s, published: true },
      });
    }

    for (const l of lessons) {
      await prisma.lesson.upsert({
        where: { slug: l.slug },
        update: { ...l, published: true },
        create: { id: randomUUID(), ...l, published: true },
      });
    }

    await prisma.deckTemplate.upsert({
      where: { slug: deckTemplate.slug },
      update: { ...deckTemplate },
      create: { id: randomUUID(), ...deckTemplate },
    });

    // eslint-disable-next-line no-console
    console.log(
      `seeded ${scenarios.length} scenarios, ${lessons.length} lessons, 1 deck template`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();

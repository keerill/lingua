import Link from 'next/link';
import { getScenarios } from '../lib/content';
import { APP_URL } from '../lib/config';
import styles from './page.module.scss';

export default async function HomePage() {
  const scenarios = await getScenarios();

  return (
    <div className="container">
      <section className={styles.hero}>
        <h1>
          Practise English with an AI partner that remembers your mistakes.
        </h1>
        <p className={styles.lede}>
          Lingua blends spaced-repetition vocabulary with real-time
          conversation. Every slip in a chat becomes a review card — so you
          actually fix it.
        </p>
        <a className={styles.cta} href={APP_URL}>
          Start practising
        </a>
      </section>

      <section className={styles.features}>
        <article className={styles.feature}>
          <h3>Smart flashcards</h3>
          <p>
            An FSRS scheduler shows each word exactly when you’re about to
            forget it.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>Live conversation</h3>
          <p>
            Chat with an AI partner in real scenarios — interviews, travel,
            small talk.
          </p>
        </article>
        <article className={styles.feature}>
          <h3>Closed feedback loop</h3>
          <p>
            Mistakes detected mid-conversation are turned into due review cards
            automatically.
          </p>
        </article>
      </section>

      <h2 className={styles.sectionTitle}>Conversation scenarios</h2>
      {scenarios.length === 0 ? (
        <p>
          Scenarios are loading — start the content service to see the
          catalogue.
        </p>
      ) : (
        <div className={styles.cards}>
          {scenarios.map((s) => (
            <Link
              key={s.id}
              href={`/scenarios/${s.slug}`}
              className={styles.card}
            >
              <h4>{s.title}</h4>
              <p>{s.description}</p>
              <span className={styles.level}>{s.level}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

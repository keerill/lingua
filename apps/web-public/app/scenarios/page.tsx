import type { Metadata } from 'next';
import Link from 'next/link';
import { getScenarios } from '../../lib/content';
import styles from '../page.module.scss';

export const metadata: Metadata = {
  title: 'Conversation scenarios',
  description:
    'Browse Lingua’s AI conversation scenarios — job interviews, travel, small talk and more, by CEFR level.',
  alternates: { canonical: '/scenarios' },
};

export default async function ScenariosPage() {
  const scenarios = await getScenarios();

  return (
    <div className="container">
      <h1>Conversation scenarios</h1>
      <p>Pick a situation and practise it live with the AI partner.</p>

      {scenarios.length === 0 ? (
        <p>No scenarios published yet.</p>
      ) : (
        <div className={styles.cards}>
          {scenarios.map((s) => (
            <Link key={s.id} href={`/scenarios/${s.slug}`} className={styles.card}>
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

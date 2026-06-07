import type { Metadata } from 'next';
import styles from './pricing.module.scss';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, honest pricing for Lingua — start free, upgrade when you’re ready.',
  alternates: { canonical: '/pricing' },
};

const tiers = [
  {
    name: 'Free',
    price: '$0',
    blurb: 'Everything you need to get started.',
    features: ['Spaced-repetition flashcards', '1 conversation scenario/day', 'Basic progress stats'],
  },
  {
    name: 'Pro',
    price: '$9/mo',
    blurb: 'Serious daily practice.',
    features: ['Unlimited conversations', 'Full progress dashboard', 'Smart reminders'],
    featured: true,
  },
  {
    name: 'Teams',
    price: 'Contact us',
    blurb: 'For schools and classrooms.',
    features: ['Admin Studio access', 'Shared content library', 'Seat management'],
  },
];

export default function PricingPage() {
  return (
    <div className="container">
      <h1>Pricing</h1>
      <p>This is a portfolio demo — no real billing. The tiers below are illustrative.</p>

      <div className={styles.grid}>
        {tiers.map((t) => (
          <div key={t.name} className={t.featured ? styles.cardFeatured : styles.card}>
            <h3>{t.name}</h3>
            <p className={styles.price}>{t.price}</p>
            <p className={styles.blurb}>{t.blurb}</p>
            <ul className={styles.features}>
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

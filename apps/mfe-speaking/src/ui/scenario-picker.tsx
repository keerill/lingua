import type { ScenarioInfo } from '../model/api';
import styles from './speaking-screen.module.scss';

export function ScenarioPicker({
  scenarios,
  loading,
  error,
  onPick,
}: {
  scenarios: ScenarioInfo[];
  loading: boolean;
  error: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <section className={styles.screen}>
      <h2>Practice speaking</h2>
      <p className={styles.muted}>
        Pick a scenario and talk to the AI. Mistakes you make turn into review
        cards.
      </p>
      {loading && <p>Loading scenarios…</p>}
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.scenarioList}>
        {scenarios.map((s) => (
          <li key={s.id} className={styles.scenarioCard}>
            <div>
              <strong>{s.title}</strong>
              <p className={styles.muted}>{s.description}</p>
            </div>
            <button className={styles.primary} onClick={() => onPick(s.id)}>
              Start
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

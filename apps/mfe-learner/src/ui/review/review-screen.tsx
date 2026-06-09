import { Link } from 'react-router-dom';
import type { ReviewGrade } from '@lingua/contracts';
import { useReviewViewModel } from '../../model/view-models/use-review.view-model';
import styles from './review-screen.module.scss';

const GRADES: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: 1, label: 'Again', className: styles.again },
  { grade: 2, label: 'Hard', className: styles.hard },
  { grade: 3, label: 'Good', className: styles.good },
  { grade: 4, label: 'Easy', className: styles.easy },
];

/** Pure View — review session: show card → reveal → grade 1–4 → next. */
export function ReviewScreen() {
  const vm = useReviewViewModel();

  if (vm.isLoading) return <p className={styles.screen}>Loading queue…</p>;
  if (vm.error) return <p className={`${styles.screen} ${styles.error}`}>{vm.error}</p>;

  if (!vm.current) {
    return (
      <section className={styles.screen}>
        <h2>Review</h2>
        <p>🎉 Nothing due right now. Add cards or come back later.</p>
        <Link to="/app">← Back to decks</Link>
      </section>
    );
  }

  const current = vm.current;

  return (
    <section className={styles.screen}>
      <h2>Review ({vm.dueCount} due)</h2>
      <div className={styles.card}>
        <div className={styles.term}>{current.term}</div>
        {vm.revealed ? (
          <div className={styles.answer}>
            {current.translation}
            {current.example && <div className={styles.example}>{current.example}</div>}
          </div>
        ) : (
          <button className={styles.reveal} onClick={vm.reveal}>
            Show answer
          </button>
        )}
      </div>

      {vm.revealed && (
        <div className={styles.grades}>
          {GRADES.map((g) => (
            <button
              key={g.grade}
              className={`${styles.grade} ${g.className}`}
              disabled={vm.isSubmitting}
              onClick={() => vm.grade(current.cardId, g.grade)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

import { Link, useParams } from 'react-router-dom';
import { useDeckDetailViewModel } from '../../model/view-models/use-deck-detail.view-model';
import styles from './deck-detail-screen.module.scss';

/** Pure View — add cards to a deck. */
export function DeckDetailScreen() {
  const { deckId = '' } = useParams();
  const vm = useDeckDetailViewModel(deckId);

  return (
    <section className={styles.screen}>
      <p>
        <Link to="/app">← Back to decks</Link>
      </p>
      <h2>Add cards</h2>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          vm.submitCard();
        }}
      >
        <input
          className={styles.input}
          value={vm.term}
          onChange={(e) => vm.setTerm(e.target.value)}
          placeholder="Term (en)"
        />
        <input
          className={styles.input}
          value={vm.translation}
          onChange={(e) => vm.setTranslation(e.target.value)}
          placeholder="Translation (ru)"
        />
        <input
          className={styles.input}
          value={vm.example}
          onChange={(e) => vm.setExample(e.target.value)}
          placeholder="Example (optional)"
        />
        <button type="submit" disabled={vm.isAdding}>
          Add card
        </button>
      </form>
      {vm.error && <p className={styles.error}>{vm.error}</p>}

      {vm.added.length > 0 && (
        <>
          <h3 className={styles.added}>Added this session</h3>
          <ul>
            {vm.added.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

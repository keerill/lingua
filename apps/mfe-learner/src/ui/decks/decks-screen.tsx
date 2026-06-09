import { Link } from 'react-router-dom';
import { useDecksViewModel } from '../../model/view-models/use-decks.view-model';
import styles from './decks-screen.module.scss';

/** Pure View — renders the decks ViewModel, no business logic, no inline styles. */
export function DecksScreen() {
  const vm = useDecksViewModel();

  return (
    <section className={styles.screen}>
      <h2>Your decks</h2>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          vm.submitDeck();
        }}
      >
        <input
          className={styles.input}
          value={vm.title}
          onChange={(e) => vm.setTitle(e.target.value)}
          placeholder="New deck title"
        />
        <button type="submit" disabled={vm.isCreating}>
          Add deck
        </button>
      </form>

      {vm.isLoading && <p>Loading…</p>}
      {vm.error && <p className={styles.error}>{vm.error}</p>}

      <ul className={styles.list}>
        {vm.decks.map((d) => (
          <li key={d.id} className={styles.deck}>
            <strong>{d.title}</strong>{' '}
            <span className={styles.langs}>
              ({d.langFrom}→{d.langTo})
            </span>
            <Link to={`/app/decks/${d.id}`} className={styles.addLink}>
              Add cards →
            </Link>
          </li>
        ))}
      </ul>
      {vm.isEmpty && <p>No decks yet — create one above.</p>}

      <p className={styles.reviewLink}>
        <Link to="/app/review">Start review session →</Link>
      </p>
    </section>
  );
}

import type { ContentLevel } from '@lingua/contracts';
import { useDeckTemplatesViewModel } from '../../model/view-models/use-deck-templates.view-model';
import styles from '../studio.module.scss';

const LEVELS: ContentLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function DeckTemplatesScreen() {
  const vm = useDeckTemplatesViewModel();

  return (
    <section className={styles.screen}>
      <h2>Deck templates</h2>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          vm.submit();
        }}
      >
        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="slug"
            value={vm.slug}
            onChange={(e) => vm.setSlug(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Title"
            value={vm.title}
            onChange={(e) => vm.setTitle(e.target.value)}
          />
          <select
            className={styles.select}
            value={vm.level}
            onChange={(e) => vm.setLevel(e.target.value as ContentLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <input
          className={styles.input}
          placeholder="Description"
          value={vm.description}
          onChange={(e) => vm.setDescription(e.target.value)}
        />
        <textarea
          className={styles.textarea}
          placeholder={
            'One card per line:\nterm | translation | example (optional)'
          }
          value={vm.cardsText}
          onChange={(e) => vm.setCardsText(e.target.value)}
        />
        <div className={styles.row}>
          <span className={styles.hint}>{vm.parsedCount} card(s) parsed</span>
          <button
            className={styles.button}
            type="submit"
            disabled={!vm.canSubmit || vm.isSaving}
          >
            Add template
          </button>
        </div>
      </form>

      {vm.isLoading && <p>Loading…</p>}
      {vm.error && <p className={styles.error}>{vm.error}</p>}

      <ul className={styles.list}>
        {vm.templates.map((t) => (
          <li key={t.id} className={styles.item}>
            <span className={styles.itemMain}>
              <strong>{t.title}</strong>{' '}
              <span className={styles.hint}>/{t.slug}</span>
              <br />
              <span className={styles.hint}>
                {t.cards.length} card(s) — {t.description}
              </span>
            </span>
            <span className={styles.tag}>{t.level}</span>
            <button className={styles.danger} onClick={() => vm.remove(t.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

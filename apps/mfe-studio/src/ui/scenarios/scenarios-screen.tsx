import type { ContentLevel } from '@lingua/contracts';
import { useScenariosViewModel } from '../../model/view-models/use-scenarios.view-model';
import styles from '../studio.module.scss';

const LEVELS: ContentLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function ScenariosScreen() {
  const vm = useScenariosViewModel();

  return (
    <section className={styles.screen}>
      <h2>Scenarios</h2>

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
            placeholder="slug (e.g. job-interview)"
            value={vm.form.slug}
            onChange={(e) => vm.setField('slug', e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Title"
            value={vm.form.title}
            onChange={(e) => vm.setField('title', e.target.value)}
          />
          <select
            className={styles.select}
            value={vm.form.level}
            onChange={(e) =>
              vm.setField('level', e.target.value as ContentLevel)
            }
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
          placeholder="Short description (shown to learners)"
          value={vm.form.description}
          onChange={(e) => vm.setField('description', e.target.value)}
        />
        <textarea
          className={styles.textarea}
          placeholder="System prompt — instructs the AI partner (not shown to learners)"
          value={vm.form.systemPrompt}
          onChange={(e) => vm.setField('systemPrompt', e.target.value)}
        />
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={vm.form.published ?? false}
            onChange={(e) => vm.setField('published', e.target.checked)}
          />
          Published
        </label>
        <div className={styles.row}>
          <button
            className={styles.button}
            type="submit"
            disabled={!vm.canSubmit || vm.isSaving}
          >
            Add scenario
          </button>
        </div>
      </form>

      {vm.isLoading && <p>Loading…</p>}
      {vm.error && <p className={styles.error}>{vm.error}</p>}

      <ul className={styles.list}>
        {vm.scenarios.map((s) => (
          <li key={s.id} className={styles.item}>
            <span className={styles.itemMain}>
              <strong>{s.title}</strong>{' '}
              <span className={styles.hint}>/{s.slug}</span>
              <br />
              <span className={styles.hint}>{s.description}</span>
            </span>
            <span className={s.published ? styles.tagPublished : styles.tag}>
              {s.published ? 'published' : 'draft'}
            </span>
            <span className={styles.tag}>{s.level}</span>
            <button
              className={styles.linkButton}
              onClick={() => vm.togglePublished(s)}
            >
              {s.published ? 'Unpublish' : 'Publish'}
            </button>
            <button className={styles.danger} onClick={() => vm.remove(s.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

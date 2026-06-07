import type { ContentLevel } from '@lingua/contracts';
import { useLessonsViewModel } from '../../model/view-models/use-lessons.view-model';
import styles from '../studio.module.scss';

const LEVELS: ContentLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function LessonsScreen() {
  const vm = useLessonsViewModel();

  return (
    <section className={styles.screen}>
      <h2>Lessons</h2>

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
          placeholder="One-line summary"
          value={vm.form.summary}
          onChange={(e) => vm.setField('summary', e.target.value)}
        />
        <textarea
          className={styles.textarea}
          placeholder="Lesson content (markdown)"
          value={vm.form.contentMarkdown}
          onChange={(e) => vm.setField('contentMarkdown', e.target.value)}
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
            Add lesson
          </button>
        </div>
      </form>

      {vm.isLoading && <p>Loading…</p>}
      {vm.error && <p className={styles.error}>{vm.error}</p>}

      <ul className={styles.list}>
        {vm.lessons.map((l) => (
          <li key={l.id} className={styles.item}>
            <span className={styles.itemMain}>
              <strong>{l.title}</strong>{' '}
              <span className={styles.hint}>/{l.slug}</span>
              <br />
              <span className={styles.hint}>{l.summary}</span>
            </span>
            <span className={l.published ? styles.tagPublished : styles.tag}>
              {l.published ? 'published' : 'draft'}
            </span>
            <span className={styles.tag}>{l.level}</span>
            <button className={styles.danger} onClick={() => vm.remove(l.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { NavLink, Route, Routes } from 'react-router-dom';
import { ApiProvider, type ApiFetch } from './model/api';
import { ScenariosScreen } from './ui/scenarios/scenarios-screen';
import { LessonsScreen } from './ui/lessons/lessons-screen';
import { DeckTemplatesScreen } from './ui/deck-templates/deck-templates-screen';
import styles from './ui/studio.module.scss';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? styles.navLinkActive : styles.navLink;

export default function StudioApp({ api }: { api: ApiFetch }) {
  return (
    <ApiProvider api={api}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <NavLink end to="/studio" className={navClass}>
            Scenarios
          </NavLink>
          <NavLink to="/studio/lessons" className={navClass}>
            Lessons
          </NavLink>
          <NavLink to="/studio/templates" className={navClass}>
            Deck templates
          </NavLink>
        </nav>
        <Routes>
          <Route index element={<ScenariosScreen />} />
          <Route path="lessons" element={<LessonsScreen />} />
          <Route path="templates" element={<DeckTemplatesScreen />} />
        </Routes>
      </div>
    </ApiProvider>
  );
}

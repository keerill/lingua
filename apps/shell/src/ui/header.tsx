import { Link } from 'react-router-dom';
import { useAuth } from '../model/auth/auth-context';
import styles from './app.module.scss';

/** Top navigation bar (pure View — consumes the auth ViewModel). */
export function Header() {
  const { authenticated, login, logout } = useAuth();
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand}>
        🗣️ Lingua
      </Link>
      <nav className={styles.nav}>
        <Link to="/app">Learn</Link>
      </nav>
      <span className={styles.spacer}>
        {authenticated ? (
          <button onClick={() => void logout()}>Log out</button>
        ) : (
          <button onClick={login}>Log in</button>
        )}
      </span>
    </header>
  );
}

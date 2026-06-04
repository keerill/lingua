import { Link } from 'react-router-dom';
import { useAuth } from '../model/auth/auth-context';
import styles from './app.module.scss';

export function Header() {
  const { authenticated, roles, login, logout } = useAuth();
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand}>
        🗣️ Lingua
      </Link>
      <nav className={styles.nav}>
        <Link to="/app">Learn</Link>
        <Link to="/speaking">Speak</Link>
        <Link to="/progress">Progress</Link>
        {roles.includes('admin') && <Link to="/studio">Studio</Link>}
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

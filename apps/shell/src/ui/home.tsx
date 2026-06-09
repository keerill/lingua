import { Link } from 'react-router-dom';
import { useAuth } from '../model/auth/auth-context';
import styles from './app.module.scss';

/** Landing view. */
export function Home() {
  const { authenticated, login } = useAuth();
  return (
    <main className={styles.home}>
      <h1>Lingua — English trainer</h1>
      <p>Decks, spaced-repetition flashcards, and (soon) AI conversation practice.</p>
      {authenticated ? (
        <Link to="/app">Go to your decks →</Link>
      ) : (
        <button onClick={login}>Log in with Keycloak</button>
      )}
    </main>
  );
}

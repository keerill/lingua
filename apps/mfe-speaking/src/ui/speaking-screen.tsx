import {
  useSpeakingSessionViewModel,
  type Pronunciation,
} from '../model/view-models/use-speaking-session.view-model';
import { ScenarioPicker } from './scenario-picker';
import styles from './speaking-screen.module.scss';

export function SpeakingScreen({ accessToken }: { accessToken: string }) {
  const vm = useSpeakingSessionViewModel(accessToken);

  if (!vm.scenario) {
    return (
      <ScenarioPicker
        scenarios={vm.scenarios}
        loading={vm.scenariosLoading}
        error={vm.scenariosError}
        onPick={vm.selectScenario}
      />
    );
  }

  const title =
    vm.scenarios.find((s) => s.id === vm.scenario)?.title ?? vm.scenario;

  return (
    <section className={styles.screen}>
      <header className={styles.bar}>
        <div>
          <h2>{title}</h2>
          <span className={styles.muted}>connection: {vm.status}</span>
        </div>
        <button onClick={vm.leave}>Leave</button>
      </header>

      <ul className={styles.history}>
        {vm.history.map((turn, i) => (
          <li key={i} className={styles.turn}>
            <p className={styles.userLine}>🧑 {turn.user}</p>
            <p className={styles.aiLine}>🤖 {turn.ai}</p>
          </li>
        ))}
      </ul>

      <div className={styles.current}>
        {vm.transcript && <p className={styles.userLine}>🧑 {vm.transcript}</p>}
        {vm.pronunciation && (
          <PronunciationBadge pronunciation={vm.pronunciation} />
        )}
        {vm.aiReply && <p className={styles.aiLine}>🤖 {vm.aiReply}</p>}
        {vm.processing && !vm.aiReply && (
          <p className={styles.muted}>thinking…</p>
        )}
        {vm.audioUrl && (
          <audio className={styles.audio} src={vm.audioUrl} autoPlay controls />
        )}
      </div>

      {vm.error && <p className={styles.error}>{vm.error}</p>}

      <div className={styles.controls}>
        <button
          className={vm.recording ? styles.recording : styles.primary}
          onClick={vm.toggleRecording}
          disabled={!vm.connected || (vm.processing && !vm.recording)}
        >
          {vm.recording ? '⏹ Stop & send' : '🎙 Hold a turn'}
        </button>
      </div>
    </section>
  );
}

function PronunciationBadge({
  pronunciation,
}: {
  pronunciation: Pronunciation;
}) {
  return (
    <div className={styles.pron}>
      <span className={styles.pronScore}>
        pronunciation {Math.round(pronunciation.score)}
      </span>
      <span className={styles.words}>
        {pronunciation.words.map((w, i) => (
          <span
            key={i}
            className={
              w.score >= 75
                ? styles.wordGood
                : w.score >= 50
                  ? styles.wordOk
                  : styles.wordBad
            }
          >
            {w.word}
          </span>
        ))}
      </span>
    </div>
  );
}

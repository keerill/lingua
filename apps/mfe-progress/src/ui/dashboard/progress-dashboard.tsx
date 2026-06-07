import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProgressViewModel } from '../../model/view-models/use-progress.view-model';
import styles from './progress-dashboard.module.scss';

export function ProgressDashboardScreen() {
  const vm = useProgressViewModel();

  if (vm.isLoading) return <p className={styles.screen}>Loading…</p>;
  if (vm.error) return <p className={styles.error}>{vm.error}</p>;
  if (!vm.dashboard) return <p className={styles.screen}>No data yet.</p>;

  const { overview, reviewsByDay, learnedByDay, pronunciationTrend } =
    vm.dashboard;

  return (
    <section className={styles.screen}>
      <h2>Your progress</h2>

      <div className={styles.stats}>
        <Stat
          label="Current streak"
          value={`${overview.currentStreak}🔥`}
          hint={`best ${overview.longestStreak}`}
        />
        <Stat label="Words learned" value={overview.learnedWords} />
        <Stat label="Cards due now" value={overview.dueCount} />
        <Stat label="Total reviews" value={overview.totalReviews} />
      </div>

      {vm.isEmpty ? (
        <p className={styles.empty}>
          No reviews yet — do a review session and a speaking practice, then
          come back.
        </p>
      ) : (
        <div className={styles.charts}>
          <Chart title="Reviews over time">
            <LineChart data={reviewsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </Chart>

          <Chart title="Words learned per day">
            <BarChart data={learnedByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" />
            </BarChart>
          </Chart>

          <Chart title="Pronunciation mistakes (lower is better)">
            <LineChart data={pronunciationTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="mistakes"
                stroke="#dc2626"
                strokeWidth={2}
              />
            </LineChart>
          </Chart>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) {
  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

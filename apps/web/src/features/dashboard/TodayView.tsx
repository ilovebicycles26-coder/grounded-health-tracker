import { Card } from '@grounded/ui/web';
import { formatWeight, type WeightSummary } from '@grounded/weight';
import { Link } from 'react-router-dom';

export interface TodayViewProps {
  readonly displayName: string;
  readonly weight: WeightSummary;
  readonly weightStatus: 'loading' | 'ready' | 'error';
  readonly unitSystem: 'metric' | 'imperial';
  readonly isOnline: boolean;
  readonly onRetry: () => void;
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'there';
}

function WeightCard({
  status,
  summary,
  unitSystem,
  onRetry,
}: {
  readonly status: TodayViewProps['weightStatus'];
  readonly summary: WeightSummary;
  readonly unitSystem: TodayViewProps['unitSystem'];
  readonly onRetry: TodayViewProps['onRetry'];
}) {
  if (status === 'loading') {
    return (
      <Card className="dashboard-card dashboard-card--weight" aria-live="polite">
        <p className="eyebrow">WEIGHT</p>
        <h2>Finding your latest entry…</h2>
        <p>Your saved data remains available on this device.</p>
      </Card>
    );
  }
  if (status === 'error') {
    return (
      <Card className="dashboard-card dashboard-card--weight">
        <p className="eyebrow">WEIGHT</p>
        <h2>Weight summary unavailable</h2>
        <p>Your data has not been changed.</p>
        <button className="ui-button ui-button--secondary" onClick={onRetry} type="button">
          Try again
        </button>
      </Card>
    );
  }
  if (!summary.current) {
    return (
      <Card className="dashboard-card dashboard-card--weight">
        <p className="eyebrow">WEIGHT</p>
        <h2>Start when you are ready</h2>
        <p>A weekly entry is enough to reveal the direction without focusing on daily noise.</p>
        <Link className="text-action" to="/progress/weight">
          Log first weight
        </Link>
      </Card>
    );
  }

  const change = summary.changeKilograms;
  const direction =
    change === null || change === 0
      ? 'Holding steady'
      : change < 0
        ? `${Math.abs(change).toFixed(1)} kg down overall`
        : `${change.toFixed(1)} kg up overall`;
  return (
    <Card className="dashboard-card dashboard-card--weight">
      <div className="dashboard-card__heading">
        <p className="eyebrow">WEIGHT</p>
        <span>{summary.current.measuredOn}</span>
      </div>
      <strong className="dashboard-value">
        {formatWeight(summary.current.kilograms, unitSystem)}
      </strong>
      <p>{direction}. The long-term trend matters more than one reading.</p>
      {summary.progress !== null ? (
        <div className="progress-meter">
          <div
            aria-label={`${Math.round(summary.progress * 100)}% of weight goal completed`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(summary.progress * 100)}
            role="progressbar"
          >
            <span style={{ width: `${Math.round(summary.progress * 100)}%` }} />
          </div>
          <small>{Math.round(summary.progress * 100)}% towards your personal goal</small>
        </div>
      ) : null}
      <Link className="text-link" to="/progress/weight">
        View weight progress
      </Link>
    </Card>
  );
}

function ModuleCard({
  eyebrow,
  title,
  description,
  to,
  action,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly to?: string;
  readonly action: string;
}) {
  return (
    <Card className="dashboard-card dashboard-card--module">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {to ? (
        <Link className="text-link" to={to}>
          {action}
        </Link>
      ) : (
        <span className="module-status">Coming in the next build</span>
      )}
    </Card>
  );
}

export function TodayView({
  displayName,
  weight,
  weightStatus,
  unitSystem,
  isOnline,
  onRetry,
}: TodayViewProps) {
  return (
    <section className="page dashboard-page" aria-labelledby="today-title">
      {!isOnline ? (
        <div className="offline-banner" role="status">
          You are offline. You can keep logging; changes will sync when you reconnect.
        </div>
      ) : null}
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">TODAY</p>
          <h1 id="today-title">Hello, {firstName(displayName)}.</h1>
          <p className="lede">A calm view of what matters today—and nothing you need to perfect.</p>
        </div>
        <Link className="primary-action" to="/progress/weight">
          Log weight
        </Link>
      </header>

      <div className="dashboard-grid">
        <WeightCard
          onRetry={onRetry}
          status={weightStatus}
          summary={weight}
          unitSystem={unitSystem}
        />
        <ModuleCard
          action="Open food diary"
          description="Log meals and see a useful daily total without judgement."
          eyebrow="NUTRITION"
          title="Fuel the day"
          to="/nutrition"
        />
        <ModuleCard
          action="View your plan"
          description="Cycling, kettlebells, bodyweight and mobility—built around activities you enjoy."
          eyebrow="MOVEMENT"
          title="Move your way"
          to="/exercise"
        />
        <ModuleCard
          action="Check in"
          description="Supplements, water, sleep and any small daily action you choose."
          eyebrow="HABITS"
          title="Keep it sustainable"
          to="/habits"
        />
      </div>
    </section>
  );
}

import { formatPercent } from '../lib/evaluation.js';
import '../team-progress-ring.css';

export default function TeamProgressRing({ value, label = '예상 작업량을 반영한 팀 진행률', compact = false }) {
  const available = value != null;
  const percent = available ? Math.min(100, Math.max(0, Number(value))) : 0;
  const displayPercent = compact
    ? `${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`
    : formatPercent(value);
  return (
    <div
      className={`team-progress-ring ${compact ? 'team-progress-ring--compact' : 'dashboard-progress-ring home-progress-ring'}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={available ? percent : undefined}
      aria-valuetext={available ? undefined : '계산할 작업 없음'}
    >
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="home-ring-track" cx="80" cy="80" r="68" />
        <circle className="home-ring-value" cx="80" cy="80" r="68" pathLength="100"
          strokeDasharray="100" strokeDashoffset={100 - percent} strokeOpacity={percent > 0 ? 1 : 0} />
      </svg>
      <div>
        <strong>{available ? displayPercent : '—'}</strong>
        {!compact && <small>{available ? '완료한 만큼, 한 걸음 더' : '계산할 작업 없음'}</small>}
      </div>
    </div>
  );
}

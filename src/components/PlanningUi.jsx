import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteriaDescriptions } from '../lib/peerCriteria.js';
import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import PeerCriteriaScores from './PeerCriteriaScores.jsx';

function FeedbackCriterionHelp({ label, description }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="feedback-criterion-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`${label} 설명`}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      {open && <span className="feedback-criterion-tooltip" id={id} role="tooltip">{description}</span>}
    </span>
  );
}

export function MetricCard({ label, value, description, accent = false }) {
  return (
    <article className={`metric-card ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {description && <p>{description}</p>}
    </article>
  );
}
export function ProgressBar({ value, label }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value == null ? undefined : Number(value)}
      aria-valuetext={value == null ? '계산할 작업 없음' : undefined}
    >
      <span
        style={{ width: `${Math.min(100, Math.max(0, Number(value || 0)))}%` }}
      />
    </div>
  );
}
export function RoundPicker({ rounds, selected, onSelect }) {
  return (
    <div className="round-tabs" role="group" aria-label="평가 회차 선택">
      {rounds.map((round) => (
        <button
          key={round.id}
          className={selected === round.id ? 'active' : ''}
          aria-pressed={selected === round.id}
          onClick={() => onSelect(round.id)}
        >
          <strong>{roundLabels[round.type]}</strong>
          <span>{roundStatusLabels[round.status]}</span>
        </button>
      ))}
    </div>
  );
}
export function FeedbackSummary({ member }) {
  return <div className="feedback-layout">
    <section className="feedback-criteria" aria-label="항목별 협업 평균">
      <div className="feedback-score-heading"><h2>항목별 평균</h2><span>5점 만점</span></div>
      <PeerCriteriaScores averages={member.averageScores}
        renderHelp={(code, label) => <FeedbackCriterionHelp label={label} description={peerCriteriaDescriptions[code]} />} />
    </section>
  </div>;
}

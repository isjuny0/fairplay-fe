import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteria, peerCriteriaDescriptions } from '../lib/peerCriteria.js';
import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';

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
  const criteria = Object.entries(peerCriteria).map(([code, label]) => {
    const value = member.averageScores?.[code];
    const score = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
    return { code, label, score, needsAttention: score != null && score < 3 };
  });
  return (
    <div className="feedback-layout">
      <section className="feedback-score-list" aria-label="항목별 협업 평균">
        <div className="feedback-score-heading">
          <h2>항목별 평균</h2>
          <span>5점 척도</span>
        </div>
        <dl>
          {criteria.map(({ code, label, score, needsAttention }) => (
            <div className={`feedback-score-row${needsAttention ? ' needs-attention' : ''}`} key={code}>
              <dt>
                <span className="feedback-criterion-name">
                  {label}
                  <FeedbackCriterionHelp label={label} description={peerCriteriaDescriptions[code]} />
                  {needsAttention && <span className="feedback-attention-label">확인할 항목</span>}
                </span>
              </dt>
              <dd>
                <span className="feedback-score-value">{score == null ? '집계 정보 없음' : `${score.toFixed(2)} / 5`}</span>
                {score != null && (
                  <div className="feedback-score-meter" role="meter" aria-label={`${label} 평균`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={score} aria-valuetext={`5점 만점에 ${score.toFixed(2)}점`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, score - index)) * 100}%` }} /></span>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="feedback-calculation-note">
        <p>동료에게 받은 평균이며 최종 기여율과는 별개입니다. ‘확인할 항목’은 평균 3점 미만인 항목입니다.</p>
        <p>중간 평가 마감과 팀 전원 제출 후 조회할 수 있습니다. 평가자·개별 점수·사유 원문은 제공하지 않으며, 소규모 팀의 익명성을 보장하지 않습니다.</p>
      </div>
    </div>
  );
}

import { roundLabels, roundStatusLabels } from '../lib/evaluation.js';
import { peerCriteria } from '../mock/fixtures.js';

export function MockNotice({
  children = '미구현 API의 예시 데이터입니다. 저장·제출·공개는 이 브라우저에만 반영됩니다.',
}) {
  return (
    <div className="mock-notice">
      <span className="mock-tag">목업</span>
      <span>{children}</span>
    </div>
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
export function FeedbackCards({ member }) {
  return (
    <div className="feedback-layout">
      <div className="metric-grid">
        {Object.entries(peerCriteria).map(([code, label]) => (
          <MetricCard
            key={code}
            label={label}
            value={`${Number(member.averageScores[code]).toFixed(2)} / 5`}
          />
        ))}
      </div>
      <section className="panel guidance-panel">
        <span className="eyebrow">다음 협업을 위한 안내</span>
        <h2>조금씩 개선해 보세요</h2>
        {member.improvementGuidance.length ? (
          member.improvementGuidance.map((guidance) => (
            <p key={guidance}>{guidance}</p>
          ))
        ) : (
          <p>
            현재 평균 3점 미만인 항목이 없습니다. 지금의 협업 방식을 이어가세요.
          </p>
        )}
        <p className="field-help">
          수신 평균과 고정 행동 안내입니다. 평가자·개별 점수·사유 원문은
          제공하지 않습니다.
        </p>
      </section>
    </div>
  );
}

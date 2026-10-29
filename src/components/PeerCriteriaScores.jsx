import { peerCriteria, peerCriteriaDescriptions } from '../lib/peerCriteria.js';
import { formatReportNumber } from '../lib/reportScore.js';
import '../peer-criteria-scores.css';

export default function PeerCriteriaScores({ id, averages, renderHelp }) {
  return <dl id={id} className="peer-criteria-scores">
    {Object.entries(peerCriteria).map(([code, label]) => {
      const value = averages?.[code];
      const score = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
      return <div key={code}>
        <dt title={renderHelp ? undefined : peerCriteriaDescriptions[code]}>{label}{renderHelp?.(code, label)}</dt>
        <dd>
          {score != null && <span className="peer-criteria-track" role="meter" aria-label={`${label} 평균`}
            aria-valuemin={0} aria-valuemax={5} aria-valuenow={score} aria-valuetext={`5점 만점에 ${formatReportNumber(score)}점`}>
            <span style={{ width: `${score / 5 * 100}%` }} />
          </span>}
          <strong className={score === null ? 'is-unavailable' : undefined}>{score === null ? '집계 정보 없음' : <>{formatReportNumber(score)}<small> / 5점</small></>}</strong>
        </dd>
      </div>;
    })}
  </dl>;
}

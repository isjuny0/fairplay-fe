import { formatReportNumber } from '../lib/reportScore.js';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { validReportWeights } from '../lib/reportWeights.js';
import PeerCriteriaScores from './PeerCriteriaScores.jsx';
import '../composite-score.css';

export const reportComponents = [
  { label: '작업 점수', key: 'task', scoreKey: 'taskScore', weightedKey: 'taskWeightedScore', weightKey: 'taskPercent', description: '팀 평균 완료 작업량을 충족하면 작업 점수는 100점입니다. 작업량 비율과 작업 점수는 서로 다른 값입니다. 작업량은 등록된 작업 규모와 담당 비율을 반영하며 실제 소요 시간은 아닙니다.' },
  { label: '중간 동료 평가', key: 'mid', scoreKey: 'midEvaluationScore', weightedKey: 'midWeightedScore', weightKey: 'midPercent', description: '중간 평가에서 본인이 받은 네 항목의 평균입니다. 동료 평가 평점은 5점 만점이며 100점 기준으로 환산합니다. 자기 평가는 포함하지 않습니다.' },
  { label: '최종 동료 평가', key: 'final', scoreKey: 'finalEvaluationScore', weightedKey: 'finalWeightedScore', weightKey: 'finalPercent', description: '최종 평가에서 본인이 받은 네 항목의 평균입니다. 동료 평가 평점은 5점 만점이며 100점 기준으로 환산합니다. 자기 평가는 포함하지 않습니다.' },
];
export { formatReportNumber } from '../lib/reportScore.js';

export function ReportComponentHelp({ component, details, label, children }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const button = useRef(null), tooltip = useRef(null);
  useLayoutEffect(() => {
    if (open && button.current && tooltip.current) {
      setPlaceAbove(button.current.getBoundingClientRect().bottom + 8 + tooltip.current.offsetHeight > window.innerHeight - 12);
      const bounds = tooltip.current.getBoundingClientRect();
      const originalLeft = bounds.left - horizontalOffset;
      setHorizontalOffset(Math.max(12, Math.min(originalLeft, window.innerWidth - bounds.width - 12)) - originalLeft);
    }
  }, [open]);
  return <span className="report-component-help" onMouseEnter={() => setOpen(true)}
    onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setOpen(false); }}
    onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
    <button ref={button} type="button" aria-label={label || `${component.label} 반영점수 설명`} aria-describedby={open ? tooltipId : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}><CircleHelp size={15} aria-hidden="true" /></button>
    {open && <span ref={tooltip} className="report-component-tooltip" role="tooltip" id={tooltipId}
      style={{ transform: `translateX(${horizontalOffset}px)`, ...(placeAbove ? { top: 'auto', bottom: 'calc(100% + 8px)' } : {}) }}>
      {component.description}
      {children ?? <span>{details[component.scoreKey] === null ? '산정 대상 없음' : `${formatReportNumber(details[component.scoreKey])}점`} × 평가 비중 {component.weight}% → {formatReportNumber(details[component.weightedKey])}점 반영</span>}
    </span>}
  </span>;
}
export function ContributionBreakdown({ details, components, evaluatedMemberCount, personal, guide }) {
  return <div className="report-score-components report-visual-breakdown composite-breakdown">
    <p>종합점수 구성 <span>100점 기준</span></p>
    <div className="report-composition-track" aria-hidden="true">{components.map((component) => <span key={component.key}
      className={`report-component-color--${component.key}`} style={{ width: `${details[component.weightedKey]}%` }} />)}</div>
    <dl>{components.map((component) => <div key={component.key}>
      <dt><i className={`report-component-dot report-component-color--${component.key}`} aria-hidden="true" />{component.label}
        <ReportComponentHelp component={component} details={details} />
        {component.key === 'task' && <span className="composite-work-ratio">
          <span>{personal ? '내 완료 작업량 비율' : '완료 작업량 비율'} <strong>{details.taskRatioPercent === null ? '산정 대상 없음' : `${formatReportNumber(details.taskRatioPercent)}%`}</strong>
          <ReportComponentHelp component={{ label: '완료 작업량 비율', description: '팀이 완료한 전체 작업량 중 해당 팀원이 담당한 비율입니다. 작업 개수가 아니라 작업 규모와 담당 비율을 반영합니다.' }} details={details} label="완료 작업량 비율 설명">
            <span>{personal ? '내' : '개인'} 완료 작업량 ÷ 팀 전체 완료 작업량 × 100</span>
            {details.taskScore === null ? <span>팀 전체 완료 작업량이 없어 산정 대상이 아닙니다.</span> : <span>작업 점수는 이 비율에 고정 평가 인원 {evaluatedMemberCount}명을 곱해 최대 100점으로 환산합니다. 현재 작업 점수는 {formatReportNumber(details.taskScore)}점입니다.</span>}
            <span>이 비율을 종합점수에 그대로 더하지 않습니다.</span>
          </ReportComponentHelp></span>
        </span>}
      </dt>
      <dd><span className="composite-raw-score"><small>원점수</small><strong>{component.key === 'task'
          ? details.taskScore === null ? '산정 대상 없음' : `${formatReportNumber(details.taskScore)} / 100점`
          : `${formatReportNumber(details[`${component.key}EvaluationAverage`])} / 5점`}</strong></span>
        <span className="report-component-weight"><small>평가 비중</small><strong>{component.weight}%</strong></span>
        <span className="report-component-value"><small>반영 점수</small><strong>{formatReportNumber(details[component.weightedKey])}<small>점</small></strong></span></dd>
    </div>)}</dl>
    {guide?.stepId === 'report-components' && <div className="heading-actions preview-guide-inline-action"><button className="secondary-button" data-guide="confirm-report-components" disabled={!guide.reportReady} onClick={() => guide.confirmReportStep('report-components')}>반영 점수 확인 완료</button></div>}
  </div>;
}
export function ReportCriteriaResults({ details, guide }) {
  const [round, setRound] = useState('mid');
  const id = useId();
  const setGuideRound = guide?.setReportCriteriaRound;
  useEffect(() => {
    if (!setGuideRound) return;
    setGuideRound(round);
    return () => setGuideRound(null);
  }, [round, setGuideRound, guide?.scope]);
  return <section className="composite-criteria" aria-label="동료 평가 항목별 결과">
    <div className="section-heading"><h3>동료 평가 항목별 결과</h3><div className="composite-round-tabs" role="group" aria-label="평가 결과 회차">
      {[['mid', '중간 평가'], ['final', '최종 평가']].map(([key, label]) => <button key={key} type="button" data-guide={key === 'final' ? 'report-final-criteria' : undefined} aria-pressed={round === key} aria-controls={id} onClick={() => setRound(key)}>{label}</button>)}
    </div></div>
    <PeerCriteriaScores id={id} averages={details[`${round}CriteriaAverages`]} />
    {guide?.stepId === 'report-peer-results' && <div className="heading-actions preview-guide-inline-action"><button className="secondary-button" data-guide="confirm-report-peer-results" disabled={!guide.reportReady || round !== 'final'} onClick={() => guide.confirmReportStep('report-peer-results')}>동료 평가 확인 완료</button></div>}
  </section>;
}
export function ResultSummary({ name, totalScore, details, weights, evaluatedMemberCount, own = false, personal = false, guide, children }) {
  const appliedWeights = validReportWeights(weights) ? weights : null;
  const components = reportComponents.map((component) => ({ ...component, weight: appliedWeights?.[component.weightKey] ?? '—' }));
  return <section className={`report-score-summary composite-summary${own ? ' report-personal-summary' : ''}`} aria-label={`${name} 종합 평가 요약`}>
    <div className="report-score-total"><h2>{name} 최종 종합점수</h2>
      <strong>{formatReportNumber(totalScore)}<span> / 100점</span></strong>
      <span className="report-score-caption">개인별 100점 만점</span>
      {guide?.stepId === 'report-overview' && <button className="secondary-button" data-guide="confirm-report-overview" disabled={!guide.reportReady} onClick={() => guide.confirmReportStep('report-overview')}>종합점수 확인 완료</button>}
    </div>
    <ContributionBreakdown details={details} components={components} evaluatedMemberCount={evaluatedMemberCount} personal={personal} guide={guide} />
    {children}
    <ReportCriteriaResults details={details} guide={guide} />
  </section>;
}

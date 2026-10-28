import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { validReportWeights } from '../lib/reportWeights.js';

export const reportComponents = [
  { label: '완료 작업', key: 'task', weightKey: 'taskPercent', description: '최종 평가 마감까지 완료된 작업의 확정 작업량과 담당 배분을 기준으로 팀 내 비율을 계산합니다. 수정 중인 작업은 제외합니다. 확정 작업량은 완료 시 확정한 계획상의 규모이며 실제 소요 시간을 뜻하지 않습니다.' },
  { label: '중간 동료 평가', key: 'mid', weightKey: 'midPercent', description: '중간 평가에서 본인이 받은 점수 합계를 팀 전체가 받은 점수 합계로 나눈 비율입니다. 자기 평가는 포함하지 않습니다.' },
  { label: '최종 동료 평가', key: 'final', weightKey: 'finalPercent', description: '최종 평가에서 본인이 받은 점수 합계를 팀 전체가 받은 점수 합계로 나눈 비율입니다. 자기 평가는 포함하지 않습니다.' },
];
export const formatReportNumber = (value) => value != null && Number.isFinite(Number(value))
  ? Number(value).toFixed(1) : '—';

export function ReportComponentHelp({ component, details, personal = false }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const button = useRef(null);
  const tooltip = useRef(null);
  useLayoutEffect(() => {
    if (!open || !button.current || !tooltip.current) return;
    setPlaceAbove(button.current.getBoundingClientRect().bottom + 8 + tooltip.current.offsetHeight > window.innerHeight - 12);
  }, [open]);
  return (
    <span className="report-component-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
    >
      <button ref={button} type="button" aria-label={`${component.label} 반영분 설명`}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}>
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open && <span ref={tooltip} className="report-component-tooltip" id={tooltipId} role="tooltip"
        style={placeAbove ? { top: 'auto', bottom: 'calc(100% + 8px)' } : undefined}>
        {component.description}
        {personal && <span>%p는 최종 기여율에 더해진 크기입니다. 막대 전체 길이는 팀 전체 기여율 100%를 기준으로 합니다.</span>}
        <span>팀 내 비율 {formatReportNumber(details[`${component.key}RatioPercent`])}% × 반영 비중 {component.weight}% = {formatReportNumber(details[`${component.key}ContributionPercent`])}%p 반영</span>
      </span>}
    </span>
  );
}

export function CalculationDetails({ name, details, components, summaryLabel }) {
  return (
    <details className="report-calculation">
      <summary>{summaryLabel || `${name} 계산 근거 보기`}</summary>
      <h3>{name} 계산 근거</h3>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">{name} 최종 기여율 계산 근거</caption>
          <thead><tr>
            <th scope="col">구성 요소</th><th scope="col">팀 내 비율</th>
            <th scope="col">반영 비중</th><th scope="col">반영분</th>
          </tr></thead>
          <tbody>
            {components.map(({ label, key, weight }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{formatReportNumber(details[`${key}RatioPercent`])}%</td>
                <td>{weight}%</td>
                <td>{formatReportNumber(details[`${key}ContributionPercent`])}%p</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-help">반올림 보정 {formatReportNumber(details.roundingAdjustmentPercent)}%p · 최종 {formatReportNumber(details.totalPercent)}%</p>
      <p className="field-help">각 반영분을 더하고 반올림을 보정한 결과가 최종 기여율입니다. 표시된 수치는 소수 첫째 자리로 반올림하여 합계와 미세한 차이가 날 수 있습니다.</p>

    </details>
  );
}

export function ContributionBreakdown({ details, components, className = '', completedTasksControl, personal = false }) {
  const values = components.map(({ key }) => details[`${key}ContributionPercent`]);
  const hasValues = values.every((value) => value != null && Number.isFinite(Number(value)) && Number(value) >= 0);
  const sum = hasValues ? values.reduce((total, value) => total + Number(value), 0) : null;
  return <div className={`report-score-components report-visual-breakdown ${className}`}>
    <p>최종 기여율의 구성 {!personal && <span>항목별 반영 크기</span>}</p>
    {!personal && <div className="report-composition-track" aria-hidden="true">
      {hasValues && sum > 0 && components.map(({ key }, index) => <span key={key} className={`report-component-color--${key}`}
        style={{ width: `${Number(values[index]) / sum * 100}%` }} />)}
    </div>}
    <dl>
      {components.map((component, index) => <div key={component.key}>
        <dt><i className={`report-component-dot report-component-color--${component.key}`} aria-hidden="true" />
          {component.key === 'task' && completedTasksControl
            ? <button type="button" className="report-component-shortcut" ref={completedTasksControl.ref} aria-label="내 완료 작업 보기" aria-expanded={completedTasksControl.expanded} aria-controls={completedTasksControl.panelId} onClick={completedTasksControl.onToggle}>{component.label}<span className="report-task-action">{completedTasksControl.expanded ? '접기' : '작업 보기'}<ChevronDown size={13} aria-hidden="true" /></span></button>
            : component.label}<ReportComponentHelp component={component} details={details} personal={personal} /></dt>
        <dd><span className="report-component-meter" aria-hidden="true"><span className={`report-component-color--${component.key}`}
          style={{ width: `${hasValues && sum > 0 ? Number(values[index]) / (personal ? 100 : sum) * 100 : 0}%` }} /></span>
          <span className="report-component-value"><strong>{formatReportNumber(values[index])}<small>%p</small></strong>
            <small className="report-component-weight">{personal ? '적용 비중' : '반영 비중'} {component.weight}%</small></span>
        </dd>
      </div>)}
    </dl>
    {(!hasValues || sum === 0) && <p className="report-composition-caption">{hasValues ? '최종 기여율에 반영된 항목이 없습니다.' : '구성 정보를 확인할 수 없습니다.'}</p>}
  </div>;
}

export function ResultSummary({ name, details, weights, own = false, guide, completedTasksControl, children }) {
  const appliedWeights = validReportWeights(weights) ? weights : null;
  const components = reportComponents.map((component) => ({ ...component, weight: appliedWeights?.[component.weightKey] ?? '—' }));
  return (
    <section className={`report-score-summary${own ? ' report-personal-summary' : ''}`} aria-label={`${name} 기여율 요약`}>
      <div className="report-score-total">
        <div className="report-total-ring" aria-hidden="true" style={{ '--contribution-angle': `${Math.min(100, Math.max(0, Number(details.totalPercent) || 0)) * 3.6}deg` }} />
        <h2>{name} 최종 기여율</h2>
        <strong>{formatReportNumber(details.totalPercent)}<span>%</span></strong>
        <span className="report-score-caption">팀 전체 기여율 100% 중</span>
        {guide?.stepId === 'report-overview' && <button className="secondary-button preview-guide-report-confirm"
          data-guide="confirm-report-overview" disabled={!guide.reportReady}
          onClick={() => guide.confirmReportStep('report-overview')}>기여율 확인 완료</button>}
      </div>
      <ContributionBreakdown personal={own} details={details} components={components} completedTasksControl={completedTasksControl} />
      {guide?.stepId === 'report-components' && <div className="heading-actions preview-guide-report-components-action">
        <button className="secondary-button" data-guide="confirm-report-components" disabled={!guide.reportReady}
          onClick={() => guide.confirmReportStep('report-components')}>반영 비중 확인 완료</button>
      </div>}
      {children}
    </section>
  );
}

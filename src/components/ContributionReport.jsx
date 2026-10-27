import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { createPortal } from 'react-dom';
import '../contribution-report.css';
import RefreshButton from './RefreshButton.jsx';
import {
  getTeamReport,
  publishReport,
} from '../api/reports.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { formatDate } from '../lib/domain.js';
import { validReportWeights } from '../lib/reportWeights.js';
import { EmptyState, ErrorNotice, Modal, ResourceState } from './ui.jsx';

const reportComponents = [
  { label: '완료 작업', key: 'task', weightKey: 'taskPercent', description: '최종 평가 마감까지 완료된 작업의 예상 작업량과 담당 배분을 기준으로 팀 내 비율을 계산합니다. 수정 중인 작업은 제외합니다.' },
  { label: '중간 동료 평가', key: 'mid', weightKey: 'midPercent', description: '중간 평가에서 본인이 받은 점수 합계를 팀 전체가 받은 점수 합계로 나눈 비율입니다. 자기 평가는 포함하지 않습니다.' },
  { label: '최종 동료 평가', key: 'final', weightKey: 'finalPercent', description: '최종 평가에서 본인이 받은 점수 합계를 팀 전체가 받은 점수 합계로 나눈 비율입니다. 자기 평가는 포함하지 않습니다.' },
];
const formatReportNumber = (value) => value != null && Number.isFinite(Number(value))
  ? Number(value).toFixed(1) : '—';

function ReportComponentHelp({ component, details }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="report-component-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
    >
      <button type="button" aria-label={`${component.label} 반영분 설명`}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}>
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open && <span className="report-component-tooltip" id={tooltipId} role="tooltip">
        {component.description}
        <span>팀 내 비율 {formatReportNumber(details[`${component.key}RatioPercent`])}% × 반영 비중 {component.weight}% = {formatReportNumber(details[`${component.key}ContributionPercent`])}%p 반영</span>
      </span>}
    </span>
  );
}

function CalculationDetails({ name, details, components, guide, managementGuide, reviewContext, onReviewConfirmed }) {
  const [open, setOpen] = useState(false);
  const guidedCalculation = guide?.guiding && guide.stepId === 'report-calculation';
  const reportOpen = guide?.setReportCalculationOpen;
  useEffect(() => {
    if (!guidedCalculation) return;
    reportOpen(open);
    return () => reportOpen(false);
  }, [guidedCalculation, open, reportOpen]);
  const reportReview = managementGuide?.setManagedReportReview;
  useEffect(() => {
    if (!reportReview || !reviewContext) return;
    reportReview({ ...reviewContext, open });
    return () => reportReview(null);
  }, [reportReview, reviewContext?.reportId, reviewContext?.memberId, open]);
  return (
    <details className="report-calculation" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{name} 계산 근거 보기</summary>
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
      {guidedCalculation && <div className="heading-actions preview-guide-inline-action">
        <button className="secondary-button" data-guide="confirm-report-calculation"
          disabled={!open || !guide.reportReady}
          onClick={() => guide.confirmReportStep('report-calculation')}>계산 근거 확인 완료</button>
      </div>}
      {managementGuide && reviewContext && <div className="heading-actions preview-guide-inline-action">
        <button className="secondary-button" data-guide="confirm-management-report-review" disabled={!open || !managementGuide.reportManagementReady}
          onClick={() => { if (managementGuide.confirmReportManagementStep('management-report-review')) onReviewConfirmed(); }}>리포트 검토 완료</button>
      </div>}
    </details>
  );
}

function ResultSummary({ name, details, weights, own = false, guide, managementGuide, reviewContext, onReviewConfirmed }) {
  const appliedWeights = validReportWeights(weights) ? weights : null;
  const components = reportComponents.map((component) => ({ ...component, weight: appliedWeights?.[component.weightKey] ?? '—' }));
  return (
    <section className={`report-score-summary${own ? ' report-personal-summary' : ''}`} aria-label={`${name} 기여율 요약`}>
      <div className="report-score-total">
        <h2>{name} 최종 기여율</h2>
        <strong>{formatReportNumber(details.totalPercent)}<span>%</span></strong>
        <span className="report-score-caption">팀 전체 기여율 100% 중</span>
        {guide?.stepId === 'report-overview' && <button className="secondary-button preview-guide-report-confirm"
          data-guide="confirm-report-overview" disabled={!guide.reportReady}
          onClick={() => guide.confirmReportStep('report-overview')}>기여율 확인 완료</button>}
      </div>
      <div className="report-score-components">
        <p>최종 기여율에 반영된 값 <span>단위 %p</span></p>
        <dl>
          {components.map((component) => (
            <div key={component.key}>
              <dt>{component.label}<ReportComponentHelp component={component} details={details} /></dt>
              <dd>{formatReportNumber(details[`${component.key}ContributionPercent`])}<span>%p</span>
                <small className="report-component-weight">반영 비중 {component.weight}%</small>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {guide?.stepId === 'report-components' && <div className="heading-actions preview-guide-report-components-action">
        <button className="secondary-button" data-guide="confirm-report-components" disabled={!guide.reportReady}
          onClick={() => guide.confirmReportStep('report-components')}>반영 비중 확인 완료</button>
      </div>}
      <CalculationDetails name={name} details={details} components={components} guide={guide}
        managementGuide={managementGuide} reviewContext={reviewContext} onReviewConfirmed={onReviewConfirmed} />
    </section>
  );
}

function ReportStatus({ report }) {
  return <span className={`status-badge report-publication-status ${report.status === 'PUBLISHED' ? 'is-published' : 'is-unpublished'}`}>
    {report.status === 'PUBLISHED' ? '공개 완료' : '미공개'}
  </span>;
}

function ReportDetail({ context, report, actions, toolbarTarget, guide, managementGuide }) {
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const reviewableMembers = context.manager ? report.members.filter((member) => member.details) : [];
  const selectedMember = reviewableMembers.find((member) => member.userId === selectedMemberId);
  return (
    <div className="report-result">
      {toolbarTarget ? createPortal(<>
        <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /></div>
        {actions}
      </>, toolbarTarget) : (
        <div className="report-result-header">
          <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /></div>
          {actions}
        </div>
      )}
      {!context.manager && report.myDetails && <ResultSummary name="나의" details={report.myDetails} weights={report.weights} own guide={guide} />}
      <section className="report-team-result">
        <div className="section-heading">
          <div><h2>팀원별 최종 기여율</h2><p>팀 전체 합계 {formatReportNumber(report.totalPercent)}%</p></div>
        </div>
        <div className="report-team-layout">
          <div className="table-scroll" role="region" aria-label="팀 최종 기여율" tabIndex={0}>
            <table className={`data-table report-results-table${context.manager ? ' report-results-table--manager' : ''}`}>
              <caption className="sr-only">팀원별 최종 기여율</caption>
              <thead><tr><th scope="col">팀원</th><th scope="col">최종 기여율</th>{context.manager && <th scope="col"><span className="sr-only">계산 근거</span></th>}</tr></thead>
              <tbody>
                {report.members.map((member) => (
                  <tr className={[
                    member.userId === context.user.id ? 'report-current-member' : '',
                  ].filter(Boolean).join(' ')} key={member.userId}>
                    <th scope="row">
                      {member.name}
                      {member.userId === context.user.id && <span className="report-self-label">나</span>}
                    </th>
                    <td><div className="report-member-share">
                      <span className="report-share-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, Number(member.contributionPercent) || 0))}%` }} /></span>
                      <strong>{formatReportNumber(member.contributionPercent)}%</strong>
                    </div></td>
                    {context.manager && <td className="report-member-action">
                      {member.details ? <button type="button" className="report-member-select" data-guide-report-member={member.userId}
                        aria-label={`${member.name} 계산 근거 보기`} aria-haspopup="dialog"
                        onClick={() => setSelectedMemberId(member.userId)}>계산 근거 보기</button> : <span className="field-help">근거 없음</span>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>
      <div className="report-result-footer">
        <div className="report-dates">
          <span>작업 집계 기준 <time dateTime={report.cutoffAt}>{formatDate(report.cutoffAt)}</time></span>
          {report.status === 'PUBLISHED' && <span>공개일 <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time></span>}
        </div>
        <details className="report-method">
          <summary>집계 기준과 계산 방식</summary>
          <h3>{validReportWeights(report.weights) ? reportComponents.map((component) => `${component.label} ${report.weights[component.weightKey]}%`).join(' · ') : '반영 비중 정보를 확인할 수 없습니다.'}</h3>
          <p>각 항목의 팀 내 비율에 반영 비중을 곱한 뒤 합산합니다. 완료 작업은 작업 개수가 아닌 예상 작업량과 담당 배분을 기준으로 집계하며, 수정 중인 작업은 완료 분량에서 제외합니다.</p>
          <p className="field-help">이 리포트는 최종 평가 기준으로 확정된 결과이며 팀 홈의 현재 작업 현황과는 다릅니다. 팀원에게는 전체 최종 기여율과 본인의 계산 근거만 공개하며, 평가자·개별 동료 점수·사유 원문은 공개하지 않습니다.</p>
        </details>
      </div>
      {managementGuide?.stepId === 'management-report-result' && <div className="heading-actions preview-guide-inline-action">
        <button className="secondary-button" data-guide="confirm-management-report-result" disabled={!managementGuide.reportManagementReady}
          onClick={() => managementGuide.confirmReportManagementStep('management-report-result')}>공개 결과 확인 완료</button>
      </div>}
      {selectedMember && (
        <Modal title={`${selectedMember.name}님의 기여도 상세`} wide className="report-member-modal" onClose={() => setSelectedMemberId(null)}>
          <div className="report-result">
            <ResultSummary name={`${selectedMember.name}님의`} details={selectedMember.details} weights={report.weights}
              managementGuide={managementGuide?.stepId === 'management-report-review' && selectedMember.userId === managementGuide.reportManagementMemberId ? managementGuide : null}
              reviewContext={{ reportId: report.id, memberId: selectedMember.userId }} onReviewConfirmed={() => setSelectedMemberId(null)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
export function TeamReport({ context, manager = false, toolbarTarget, generationRevision = 0 }) {
  const guide = usePreviewGuide();
  const guidedReport = Boolean(guide?.guiding && guide.scenarioId === 'contribution-report' && !manager && !context.manager && context.team.id === 1);
  const guidedManagement = Boolean(guide?.guiding && guide.scenarioId === 'report-management' && manager && context.manager);
  const { notify } = useInteractions();
  const resource = useResource(
    () => getTeamReport(context.team.id),
    [context.team.id, context.user.id, generationRevision, guide?.scope],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [publishing, setPublishing] = useState(null);
  const selected = resource.data;
  const reportResource = guide?.setReportState;
  useEffect(() => {
    if (!guidedReport) return;
    reportResource({ report: !resource.loading && !resource.error ? selected : null, userId: context.user.id });
    return () => reportResource(null);
  }, [guidedReport, reportResource, resource.loading, resource.error, selected, context.user.id]);
  const reportResult = guide?.setManagedReportResult;
  useEffect(() => {
    if (!guidedManagement) return;
    reportResult({ teamId: context.team.id, report: !busy && !resource.loading && !resource.error ? selected : null });
    return () => reportResult(null);
  }, [guidedManagement, reportResult, busy, resource.loading, resource.error, selected, context.team.id]);
  const refreshAction = (
    <RefreshButton
      className="report-refresh"
      label="리포트 새로고침"
      disabled={busy}
      onClick={resource.reload}
    />
  );
  const resultActions = manager && (
    <div className="report-result-actions">
      {refreshAction}
      {selected?.status === 'UNPUBLISHED' && (
        <button className="primary-button" data-guide="publish-team-report"
          disabled={busy || (guidedManagement && (guide.stepId !== 'management-report-publish' || context.team.id !== guide.reportManagementTeamId))}
          onClick={() => setPublishing(selected)}>
          팀원에게 공개
        </button>
      )}
    </div>
  );
  return (
    <div className="stack team-report">
      {!(manager && selected) && (
        manager && toolbarTarget
          ? createPortal(refreshAction, toolbarTarget)
          : <div className="report-status-toolbar">{refreshAction}</div>
      )}
      <ErrorNotice error={error} />
      <ResourceState resource={resource}>
        {selected ? (
          <ReportDetail key={`${selected.id}:${context.user.id}:${guide?.scope || 'free'}`} context={context} report={selected} guide={guidedReport ? guide : null}
            managementGuide={guidedManagement && context.team.id === guide.reportManagementTeamId ? guide : null} actions={resultActions} toolbarTarget={toolbarTarget} />
        ) : manager ? (
          <EmptyState><h2>이 팀의 리포트가 아직 생성되지 않았습니다.</h2><p>상단에서 전체 리포트를 생성한 뒤 결과를 확인할 수 있습니다.</p></EmptyState>
        ) : (
          <EmptyState>
            <h2>공개된 리포트가 없습니다.</h2>
            <p>관리자가 최종 결과를 검토하고 공개하면 이곳에서 확인할 수 있습니다.</p>
          </EmptyState>
        )}
      </ResourceState>
      {publishing && (
        <Modal
          title="기여도 리포트 공개"
          busy={busy}
          onClose={() => setPublishing(null)}
        >
          <p>
            {context.team.name}의 검토한 결과를 공개합니다. 팀원은 전체 최종
            비율과 자신의 계산 근거를 보게 됩니다. 공개 후에는 결과를 수정하거나
            비공개로 되돌릴 수 없습니다.
          </p>
          <ErrorNotice error={error} />
          <div className="heading-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPublishing(null)}
            >
              취소
            </button>
            <button
              className="primary-button"
              data-guide="confirm-publish-report"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await publishReport(publishing.id);
                  setPublishing(null);
                  notify('리포트를 팀원에게 공개했습니다.');
                  resource.reload();
                } catch (error) {
                  setError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              공개 확정
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function ContributionReport({ context }) {
  return (
    <section className="stack contribution-report-page">
      <div className="page-heading page-heading--compact">
        <div>
          <h1>기여도 리포트</h1>
        </div>
      </div>
      <TeamReport context={context} />
    </section>
  );
}

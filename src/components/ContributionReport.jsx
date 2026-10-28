import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { isPreviewPath } from '../lib/previewPath.js';
import { teamPath } from '../lib/routes.js';
import '../contribution-report.css';
import RefreshButton from './RefreshButton.jsx';
import {
  getTeamReport,
} from '../api/reports.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import { ResultSummary, formatReportNumber, reportComponents } from './ReportScore.jsx';
import ContributionEvidence from './ContributionEvidence.jsx';
import ReportCompletedTasks from './ReportCompletedTasks.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

function ReportStatus({ report }) {
  return <span className={`status-badge report-publication-status ${report.status === 'PUBLISHED' ? 'is-published' : 'is-unpublished'}`}>
    {report.status === 'PUBLISHED' ? '공개 완료' : '미공개'}
  </span>;
}

function ReportDetail({ context, report, actions, toolbarTarget, guide, managementGuide, onGuideComplete }) {
  const { pathname } = useLocation();
  const completedTasksHref = `${isPreviewPath(pathname) ? '/preview' : ''}${teamPath(context.space.id, context.team.id)}/tasks?view=list&status=DONE&mine=1`;
  const [completedTasksOpen, setCompletedTasksOpen] = useState(false);
  const completedTasksId = useId();
  const completedTasksButton = useRef(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const reviewableMembers = context.manager ? report.members.filter((member) => member.details)
    : [];
  const selectedMember = reviewableMembers.find((member) => member.userId === selectedMemberId) || reviewableMembers[0];
  const memberEvidenceId = useId();
  return (
    <div className="report-result">
      {toolbarTarget ? createPortal(<>
        <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /><span>팀원 {report.members.length}명</span>
          <span>집계 기준 <time dateTime={report.cutoffAt}>{formatDate(report.cutoffAt)}</time></span>
          {report.publishedAt && <span>공개일 <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time></span>}
        </div>
        {actions}
      </>, toolbarTarget) : context.manager ? (
        <div className="report-result-header">
          <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /><span>팀원 {report.members.length}명</span>
          <span>집계 기준 <time dateTime={report.cutoffAt}>{formatDate(report.cutoffAt)}</time></span>
          {report.publishedAt && <span>공개일 <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time></span>}
        </div>
          {actions}
        </div>
      ) : null}
      {!context.manager && report.myDetails && <ResultSummary name="나의" details={report.myDetails} weights={report.weights} own guide={guide}
        completedTasksControl={{ ref: completedTasksButton, expanded: completedTasksOpen, panelId: completedTasksId, onToggle: () => setCompletedTasksOpen((open) => !open) }}>
        {completedTasksOpen && <ReportCompletedTasks key={`${report.id}:${context.user.id}`} id={completedTasksId} context={context} report={report} currentTasksHref={completedTasksHref}
          onClose={() => { setCompletedTasksOpen(false); completedTasksButton.current?.focus(); }} />}
      </ResultSummary>}
      <section className="report-team-result">
        <div className="section-heading">
          <div><h2>팀원별 최종 기여율</h2><p>팀 전체 합계 {formatReportNumber(report.totalPercent)}%</p></div>
        </div>
        {context.manager && <div className="report-composition-legend" aria-label="기여율 구성 범례">{reportComponents.map(({ key, label }) => <span key={key}><i className={`report-component-dot report-component-color--${key}`} aria-hidden="true" />{label}</span>)}</div>}
        <div className="report-team-layout">
          <div className="table-scroll" role="region" aria-label="팀 최종 기여율" tabIndex={0}>
            <table className={`data-table report-results-table${context.manager ? ' report-results-table--manager' : ''}`}>
              <caption className="sr-only">팀원별 최종 기여율</caption>
              <thead><tr><th scope="col">팀원</th><th scope="col">{context.manager ? '기여율 구성' : '최종 기여율'}</th></tr></thead>
              <tbody>
                {report.members.map((member) => (
                  <tr className={[
                    member.userId === context.user.id ? 'report-current-member' : '',
                    context.manager && member.userId === selectedMember?.userId ? 'report-selected-member' : '',
                  ].filter(Boolean).join(' ')} key={member.userId}
                    onClick={context.manager && member.details ? () => setSelectedMemberId(member.userId) : undefined}>
                    <th scope="row">
                      {context.manager && member.details ? <button type="button" className="report-member-select" data-guide-report-member={member.userId}
                        aria-label={`${member.name} 수행 근거 확인`} aria-pressed={member.userId === selectedMember?.userId}
                        aria-controls={memberEvidenceId} onClick={() => setSelectedMemberId(member.userId)}>{member.name}<span aria-hidden="true">{member.userId === selectedMember?.userId ? '선택됨' : '확인'}</span></button> : member.name}
                      {member.userId === context.user.id && <span className="report-self-label">나</span>}
                    </th>
                    <td><div className="report-member-share">
                      {context.manager ? <span className="report-member-composition" aria-hidden="true">
                        {member.details && reportComponents.map(({ key }) => <span key={key} className={`report-component-color--${key}`}
                          style={{ width: `${Math.min(100, Math.max(0, Number(member.details[`${key}ContributionPercent`]) || 0))}%` }} />)}
                      </span> : <span className="report-share-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, Number(member.contributionPercent) || 0))}%` }} /></span>}
                      <strong>{formatReportNumber(member.contributionPercent)}%</strong>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>
      {selectedMember && <ContributionEvidence key={`${report.id}:${selectedMember.userId}`} id={memberEvidenceId}
        context={context} report={report} member={selectedMember}
        onReviewConfirmed={onGuideComplete} managementGuide={managementGuide?.stepId === 'management-report-review' && selectedMember.userId === managementGuide.reportManagementMemberId ? managementGuide : null} />}

    </div>
  );
}
export function TeamReport({ context, manager = false, toolbarTarget, generationRevision = 0, hideRefresh = false, onGuideComplete }) {
  const guide = usePreviewGuide();
  const guidedReport = Boolean(guide?.guiding && guide.scenarioId === 'contribution-report' && !manager && !context.manager && context.team.id === 1);
  const guidedManagement = Boolean(guide?.guiding && guide.scenarioId === 'report-management' && manager && context.manager);
  const resource = useResource(
    () => getTeamReport(context.team.id),
    [context.team.id, context.user.id, generationRevision, guide?.scope],
  );
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
    reportResult({ teamId: context.team.id, report: !resource.loading && !resource.error ? selected : null });
    return () => reportResult(null);
  }, [guidedManagement, reportResult, resource.loading, resource.error, selected, context.team.id]);
  const refreshAction = (
    <RefreshButton
      className="report-refresh"
      label="리포트 새로고침"
      onClick={resource.reload}
    />
  );
  return (
    <div className="stack team-report">
      {!hideRefresh && !(manager && selected) && (
        manager && toolbarTarget
          ? createPortal(refreshAction, toolbarTarget)
          : <div className="report-status-toolbar">{refreshAction}</div>
      )}
      <ResourceState resource={resource}>
        {selected ? (
          <ReportDetail key={`${selected.id}:${context.user.id}:${guide?.scope || 'free'}`} context={context} report={selected} guide={guidedReport ? guide : null}
            managementGuide={guidedManagement && context.team.id === guide.reportManagementTeamId ? guide : null} actions={manager && !hideRefresh ? refreshAction : null} toolbarTarget={toolbarTarget} onGuideComplete={onGuideComplete} />
        ) : manager ? (
          <EmptyState><h2>이 팀의 리포트가 아직 생성되지 않았습니다.</h2><p>상단에서 전체 리포트를 생성한 뒤 결과를 확인할 수 있습니다.</p></EmptyState>
        ) : (
          <EmptyState>
            <h2>공개된 리포트가 없습니다.</h2>
            <p>관리자가 최종 결과를 검토하고 공개하면 이곳에서 확인할 수 있습니다.</p>
          </EmptyState>
        )}
      </ResourceState>

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

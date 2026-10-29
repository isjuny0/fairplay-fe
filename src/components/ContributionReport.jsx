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
import { formatReportNumber } from './ReportScore.jsx';
import ContributionEvidence from './ContributionEvidence.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

function ReportStatus({ report }) {
  return <span className={`status-badge report-publication-status ${report.status === 'PUBLISHED' ? 'is-published' : 'is-unpublished'}`}>
    {report.status === 'PUBLISHED' ? '공개 완료' : '미공개'}
  </span>;
}

function ReportDetail({ context, report, actions, toolbarTarget, guide, managementGuide, onGuideComplete }) {
  const { pathname } = useLocation();
  const completedTasksHref = `${isPreviewPath(pathname) ? '/preview' : ''}${teamPath(context.space.id, context.team.id)}/tasks?view=list&status=DONE&mine=1`;
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const reviewableMembers = report.members.filter((member) => member.details && (context.manager || member.userId === context.user.id));
  const selectedMember = reviewableMembers.find((member) => member.userId === selectedMemberId) || reviewableMembers[0];
  const memberEvidenceId = useId();
  const evidenceAnchor = useRef(null);
  const switchDetailMember = (userId) => {
    setSelectedMemberId(userId);
    evidenceAnchor.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  useEffect(() => {
    if (!managementGuide) return;
    const restoreGuideMember = (event) => {
      if (['report-guide-member', 'report-guide-evidence'].includes(event.detail)) setSelectedMemberId(managementGuide.reportManagementMemberId);
    };
    window.addEventListener('fairplay:guide-focus', restoreGuideMember);
    return () => window.removeEventListener('fairplay:guide-focus', restoreGuideMember);
  }, [managementGuide?.reportManagementMemberId, Boolean(managementGuide)]);
  const resultsLabel = '팀원별 종합 평가';
  return (
    <div className="report-result">
      {toolbarTarget ? createPortal(<>
        <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /><span>팀원 {report.evaluatedMemberCount}명</span>
          <span>집계 기준 <time dateTime={report.cutoffAt}>{formatDate(report.cutoffAt)}</time></span>
          {report.publishedAt && <span>공개일 <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time></span>}
        </div>
        {actions}
      </>, toolbarTarget) : (
        <div className="report-result-header">
          <div className="report-metadata" aria-label="리포트 정보"><ReportStatus report={report} /><span>팀원 {report.evaluatedMemberCount}명</span>
          <span>집계 기준 <time dateTime={report.cutoffAt}>{formatDate(report.cutoffAt)}</time></span>
          {report.publishedAt && <span>공개일 <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time></span>}
        </div>
          {actions}
        </div>
      )}
      {context.manager && <section className="report-team-result">
        <div className="section-heading"><h2>{resultsLabel}</h2></div>
        <div className="table-scroll" role="region" aria-label={resultsLabel} tabIndex={0}>
          <table className="data-table composite-results-table"><caption className="sr-only">{resultsLabel}</caption>
            <thead><tr>{['팀원', '완료 작업량 비율', '작업 점수', '중간 평가', '최종 평가', '종합점수'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{reviewableMembers.map((member) => <tr key={member.userId} className={member.userId === selectedMember?.userId ? 'report-selected-member' : ''}
              onClick={() => setSelectedMemberId(member.userId)}>
              <th scope="row"><button type="button" className="report-member-select" data-guide-report-member={member.userId}
                aria-label={`${member.name} 수행 근거 확인`} aria-pressed={member.userId === selectedMember?.userId}
                aria-controls={memberEvidenceId} onClick={() => setSelectedMemberId(member.userId)}>{member.name}<span aria-hidden="true">{member.userId === selectedMember?.userId ? '선택됨' : '확인'}</span></button></th>
              <td>{member.details.taskRatioPercent === null ? '산정 대상 없음' : `${formatReportNumber(member.details.taskRatioPercent)}%`}</td>
              <td>{member.details.taskScore === null ? '산정 대상 없음' : `${formatReportNumber(member.details.taskScore)}점`}</td>
              <td>{formatReportNumber(member.details.midEvaluationAverage)} / 5</td><td>{formatReportNumber(member.details.finalEvaluationAverage)} / 5</td>
              <td><strong>{formatReportNumber(member.totalScore)}점</strong></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
      <div ref={evidenceAnchor} className="report-evidence-anchor" />
      {selectedMember && <ContributionEvidence id={memberEvidenceId}
        members={reviewableMembers} onMemberChange={switchDetailMember}
        context={context} report={report} member={selectedMember} guide={guide} currentTasksHref={!context.manager ? completedTasksHref : undefined}
        onReviewConfirmed={onGuideComplete} managementGuide={['management-report-review', 'management-report-evidence'].includes(managementGuide?.stepId) ? managementGuide : null} />}

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

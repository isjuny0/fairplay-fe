import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { getReportEvidence } from '../api/reportEvidence.js';
import { ResourceState } from './ui.jsx';
import useResource from '../hooks/useResource.js';
import RefreshButton from './RefreshButton.jsx';
import { ResultSummary } from './ReportScore.jsx';
import ContributionEvidenceList from './ContributionEvidenceList.jsx';
import '../contribution-evidence.css';

export default function ContributionEvidence({ id, context, report, member, members, onMemberChange, guide, currentTasksHref, managementGuide, onReviewConfirmed }) {
  const evidence = useResource(() => getReportEvidence(context.team.id, member.userId, report.id),
    [context.team.id, member.userId, report, managementGuide?.scope]);
  const snapshot = !evidence.loading && !evidence.error ? evidence.data : null;
  const setReview = managementGuide?.setManagedReportReview;
  useEffect(() => {
    if (!setReview) return;
    setReview({ reportId: report.id, memberId: member.userId, open: Boolean(snapshot), loading: evidence.loading, error: Boolean(evidence.error) });
    return () => setReview(null);
  }, [setReview, report.id, member.userId, snapshot, evidence.loading, evidence.error]);
  const evidenceLabel = context.manager ? `${member.name}님의 수행 근거` : '나의 수행 근거';
  return <section id={id} className={`report-member-evidence${context.manager ? '' : ' report-member-evidence--personal'}`} aria-label={evidenceLabel}>
    {context.manager && <header className="report-member-evidence-heading">
      <h2>{evidenceLabel}</h2>
      <label className="report-detail-member-select"><span>상세 조회 팀원</span>
        <select data-guide="report-member-selector" value={member.userId} onChange={(event) => onMemberChange(event.target.value)}>
          {members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}
        </select>
      </label>
    </header>}
    <ResultSummary key={member.userId} name={context.manager ? `${member.name}님의` : '나의'} totalScore={member.totalScore} details={member.details}
      weights={report.weights} evaluatedMemberCount={report.evaluatedMemberCount} personal={!context.manager} own guide={guide} />
    {managementGuide?.stepId === 'management-report-review' && <div className="heading-actions preview-guide-inline-action">
      <button className="secondary-button" data-guide="confirm-management-report-review" disabled={!managementGuide.reportManagementReady}
        onClick={() => managementGuide.confirmReportManagementStep('management-report-review')}>점수 검토 완료</button>
    </div>}
    <div className="evidence-section-heading"><h3>반영된 완료 작업</h3>
      {snapshot && <span>{snapshot.tasks.length}건</span>}
      <RefreshButton data-guide="report-evidence-refresh" label="작업 근거 새로고침" disabled={evidence.loading} onClick={evidence.reload} />
    </div>
    <ResourceState resource={evidence} label="기여 근거">
      {snapshot && <>
        <ContributionEvidenceList key={`${snapshot.reportId}:${snapshot.userId}`} evidence={snapshot} showCalculation={false} compact guide={guide || managementGuide} />
        {currentTasksHref && <Link className="report-current-tasks-link" to={currentTasksHref}>현재 내 완료 작업 목록<ArrowUpRight size={14} aria-hidden="true" /></Link>}
        {managementGuide?.stepId === 'management-report-evidence' && <div className="heading-actions preview-guide-inline-action">
          <button className="secondary-button" data-guide="confirm-management-report-evidence" disabled={!managementGuide.reportManagementReady}
            onClick={() => { if (managementGuide.confirmReportManagementStep('management-report-evidence')) onReviewConfirmed?.(); }}>작업 근거 검토 완료</button>
        </div>}
      </>}
    </ResourceState>
  </section>;
}

import { useEffect } from 'react';
import { getReportEvidence } from '../api/reportEvidence.js';
import { ResourceState } from './ui.jsx';
import useResource from '../hooks/useResource.js';
import RefreshButton from './RefreshButton.jsx';
import { CalculationDetails, ResultSummary, reportComponents } from './ReportScore.jsx';
import ContributionEvidenceList from './ContributionEvidenceList.jsx';
import '../contribution-evidence.css';

export default function ContributionEvidence({ id, context, report, member, managementGuide, onReviewConfirmed }) {
  const evidence = useResource(() => getReportEvidence(context.team.id, member.userId, report.id),
    [context.team.id, member.userId, report.id, managementGuide?.scope]);
  const snapshot = !evidence.loading && !evidence.error ? evidence.data : null;
  const setReview = managementGuide?.setManagedReportReview;
  useEffect(() => {
    if (!setReview) return;
    setReview({ reportId: report.id, memberId: member.userId, open: Boolean(snapshot) });
    return () => setReview(null);
  }, [setReview, report.id, member.userId, snapshot]);
  const components = reportComponents.map((component) => ({ ...component, weight: snapshot?.weights[component.weightKey] }));
  return <section id={id} className="report-member-evidence" aria-label={`${member.name}님의 수행 근거`}>
    <header className="report-member-evidence-heading">
      <h2>{member.name}님의 수행 근거</h2>
      <RefreshButton label="작업 근거 새로고침" disabled={evidence.loading} onClick={evidence.reload} />
    </header>
    <ResourceState resource={evidence} label="기여 근거">
      {snapshot && <>
        <ResultSummary name={`${member.name}님의`} details={snapshot.details} weights={snapshot.weights} own />
        <div className="evidence-section-heading"><h3>반영된 완료 작업</h3><span>{snapshot.tasks.length}건</span></div>
        <ContributionEvidenceList key={`${snapshot.reportId}:${snapshot.userId}`} evidence={snapshot} showCalculation={false} compact />
        <CalculationDetails name={`${member.name}님의`} details={snapshot.details} components={components} summaryLabel="계산 상세" />
        {managementGuide && <div className="heading-actions preview-guide-inline-action">
          <button className="secondary-button" data-guide="confirm-management-report-review" disabled={!managementGuide.reportManagementReady}
            onClick={() => { if (managementGuide.confirmReportManagementStep('management-report-review')) onReviewConfirmed?.(); }}>리포트 검토 완료</button>
        </div>}
      </>}
    </ResourceState>
  </section>;
}

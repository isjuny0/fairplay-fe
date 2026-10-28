import { Link } from 'react-router';
import { ArrowUpRight, X } from 'lucide-react';
import { getReportEvidence } from '../api/reportEvidence.js';
import useResource from '../hooks/useResource.js';
import { formatDate } from '../lib/domain.js';
import ContributionEvidenceList from './ContributionEvidenceList.jsx';
import RefreshButton from './RefreshButton.jsx';
import { ResourceState } from './ui.jsx';
import { formatReportNumber } from './ReportScore.jsx';

export default function ReportCompletedTasks({ id, context, report, currentTasksHref, onClose }) {
  const resource = useResource(
    () => getReportEvidence(context.team.id, context.user.id, report.id),
    [context.team.id, context.user.id, report.id],
  );
  const evidence = resource.data;
  const ratio = evidence?.workSummary.taskRatioPercent;
  return <section id={id} className="report-completed-tasks" aria-labelledby={`${id}-heading`}>
    <div className="report-completed-heading">
      <div><h3 id={`${id}-heading`}>리포트에 반영된 내 완료 작업</h3>
        <p>집계 기준 {formatDate(report.cutoffAt)}</p></div>
      <div className="heading-actions">
        <RefreshButton label="내 완료 작업 새로고침" disabled={resource.loading} onClick={resource.reload} />
        <button type="button" className="icon-button" aria-label="내 완료 작업 닫기" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
    </div>
    <ResourceState resource={resource} label="리포트에 반영된 완료 작업">
      {evidence && <>
        <div className="report-completed-share">
          <span>완료 작업 기준 내 비율</span><strong>{formatReportNumber(ratio)}<small>%</small></strong>
          <span className="report-completed-share-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, Number(ratio) || 0))}%` }} /></span>
        </div>
        <ContributionEvidenceList key={`${evidence.reportId}:${evidence.userId}`} evidence={evidence} showCalculation={false} />
      </>}
    </ResourceState>
    <Link className="report-current-tasks-link" to={currentTasksHref}>현재 내 완료 작업 목록<ArrowUpRight size={14} aria-hidden="true" /></Link>
  </section>;
}

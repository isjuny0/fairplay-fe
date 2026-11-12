import { formatDate } from '../lib/domain.js';
import { validReportWorkload } from '../lib/reportWorkload.js';
import '../report-workload-summary.css';

const percent = (value) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);

// Display the server's snapshot values without recalculating rounded percentages.
export default function ReportWorkloadSummary({ report, member, personal }) {
  const summary = report.workloadSummary;
  if (!validReportWorkload(summary, report.evaluatedMemberCount)) return null;
  const selected = summary.members.find((item) => item.userId === member.userId);
  if (!selected) return null;
  const hasWork = selected.completedWorkSharePercent !== null;
  const equalShare = summary.equalSharePercent;
  const relativeShare = selected.relativeToTeamAveragePercent;
  const distribution = summary.formerMemberCompletedWorkSharePercent > 0
    ? [...summary.members, { userId: 'former-members', name: '탈퇴한 팀원', completedWorkSharePercent: summary.formerMemberCompletedWorkSharePercent }]
    : summary.members;
  const subject = personal ? '내' : `${member.name}님의`;

  return <section className="report-workload-summary" aria-label="팀 내 작업량 요약">
    <header className="report-workload-heading">
      <h3>팀 내 작업량 요약</h3>
      <span>평가 마감 기준 · {formatDate(report.cutoffAt)}</span>
    </header>
    <div className="report-workload-layout">
      <dl className="report-workload-metrics">
        <div>
          <dt>{subject} 완료 작업량 비중</dt>
          <dd>{hasWork ? <><strong>{percent(selected.completedWorkSharePercent)}</strong><span>%</span></> : <strong className="is-unavailable">산정 대상 없음</strong>}</dd>
          <dd className="report-workload-metric-help">팀이 완료한 작업량 중 {subject} 몫</dd>
        </div>
        <div>
          <dt>팀 평균 대비 완료 작업량</dt>
          <dd>{hasWork ? <><strong>{percent(relativeShare)}</strong><span>%</span></> : <strong className="is-unavailable">산정 대상 없음</strong>}</dd>
          <dd className="report-workload-metric-help">{hasWork ? '평균과 같으면 100%' : '완료 작업량이 없어 비교할 수 없습니다.'}</dd>
        </div>
      </dl>
      <div className="report-workload-distribution">
        <div className="report-workload-chart-heading"><h4>팀원별 완료 작업량 비중</h4>
          <span><i aria-hidden="true" />균등 기준 {percent(equalShare)}%</span>
        </div>
        <ul>{distribution.map((item) => <li key={item.userId} className={item.userId === member.userId ? 'is-selected' : ''}>
          <span className="report-workload-name">{item.name}</span>
          <span className="report-workload-track" aria-hidden="true">
            <span className="report-workload-fill" style={{ width: `${hasWork ? item.completedWorkSharePercent : 0}%` }} />
            <i style={{ left: `${equalShare}%` }} />
          </span>
          <strong>{hasWork ? `${percent(item.completedWorkSharePercent)}%` : '—'}</strong>
        </li>)}</ul>
      </div>
    </div>
    <p className="report-workload-note">예상 시간과 담당 비율을 반영한 완료 작업량입니다. 평균을 넘어선 작업량도 표시하며, 작업 점수는 최대 100점을 유지합니다.</p>
  </section>;
}

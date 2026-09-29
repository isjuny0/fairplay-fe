import { useEffect, useState } from 'react';
import { getPublishedTeamReport } from '../api/reports.js';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-';

export default function PublishedReport({ reportId, teamId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) {
      setReport(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getPublishedTeamReport({ reportId, teamId })
      .then((result) => { if (!cancelled) setReport(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || '리포트를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reportId, teamId]);

  if (loading) return <section className="report-loading" aria-label="기여도 리포트 불러오는 중"><div/><div/></section>;
  if (error) return <section className="dashboard-error" role="alert"><h1>리포트를 불러오지 못했습니다.</h1><p>{error}</p></section>;
  if (!teamId) return <><div className="page-heading"><div><h1>기여도 리포트</h1><p>교수가 공개한 팀 기여도 결과를 확인하세요.</p></div></div><section className="empty-state"><p>먼저 팀에 가입해 주세요.</p><span>가입한 팀의 리포트만 확인할 수 있습니다.</span></section></>;
  if (!report) return <><div className="page-heading"><div><h1>기여도 리포트</h1><p>교수가 공개한 팀 기여도 결과를 확인하세요.</p></div></div><section className="empty-state"><p>아직 공개된 리포트가 없습니다.</p><span>교수가 검토 후 공개하면 이곳에서 확인할 수 있습니다.</span></section></>;

  const viewer = report.members.find((member) => member.id === report.viewerMemberId);

  return <div className="published-report">
    <div className="page-heading"><div><h1>기여도 리포트</h1><p>{report.teamName} · {formatDate(report.publishedAt)} 공개</p></div><span className="status-badge status-open">공개 완료</span></div>
    <section className="report-disclaimer"><strong>교수 판단 보조 자료</strong><span>이 리포트는 자동 성적이 아닌 교수 판단 보조 자료입니다.</span></section>

    <section className="report-section"><div className="section-heading"><h2>팀 최종 기여도</h2><span>팀 합계 {report.totalPercent.toFixed(1)}%</span></div><div className="contribution-list">{report.members.map((member) => <div key={member.id} className={member.id === report.viewerMemberId ? 'is-viewer' : ''}><span>{member.name}{member.id === report.viewerMemberId && <small>나</small>}</span><strong>{member.contributionPercent.toFixed(1)}%</strong></div>)}</div></section>

    {viewer && <section className="report-section own-report-detail"><div className="section-heading"><h2>내 계산 상세</h2><span>다른 팀원의 상세 근거는 공개되지 않습니다.</span></div><div className="own-score-grid"><div><span>AI 작업 70%</span><strong>{viewer.ai.toFixed(1)}</strong></div><div><span>중간 평가 10%</span><strong>{viewer.mid.toFixed(1)}</strong></div><div><span>최종 평가 20%</span><strong>{viewer.final.toFixed(1)}</strong></div><div><span>최종 기여도</span><strong>{viewer.contributionPercent.toFixed(1)}%</strong></div></div><div className="evidence-box"><strong>반영 근거</strong><ul>{viewer.evidence.map((item) => <li key={item}>{item}</li>)}</ul></div></section>}
  </div>;
}

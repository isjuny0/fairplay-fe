import { useEffect, useMemo, useState } from 'react';
import { getReportDraft, publishReport } from '../api/reports.js';

const statusLabels = {
  DRAFT: '검토 대기',
  INSUFFICIENT_DATA: '입력 부족',
  PUBLISHED: '공개 완료',
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-';
const formatPoint = (value) => value == null ? '계산 대기' : value.toFixed(1);
const isComplete = (report) => Object.values(report.completeness).every((item) => item.completed === item.total);
const isPublishable = (report) => report.status === 'DRAFT'
  && isComplete(report)
  && report.totalPercent === 100
  && report.blockingReasons.length === 0;

function StatusBadge({ status }) {
  const className = status === 'PUBLISHED' ? 'status-open' : status === 'DRAFT' ? 'status-pending' : 'status-blocked';
  return <span className={`status-badge ${className}`}>{statusLabels[status] || status}</span>;
}

function CompletenessItem({ label, value }) {
  const complete = value.completed === value.total;
  return <div className={complete ? 'completeness-card is-complete' : 'completeness-card is-missing'}>
    <span>{label}</span><strong>{value.completed}/{value.total}</strong><small>{complete ? '입력 완료' : `${value.total - value.completed}건 부족`}</small>
  </div>;
}

export default function ReportReview({ spaceId, isAuthorized }) {
  const [bundle, setBundle] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!spaceId || !isAuthorized) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getReportDraft(spaceId)
      .then((result) => {
        if (cancelled) return;
        setBundle(result);
        setSelectedReportId((current) => result.reports.some((report) => report.id === current) ? current : result.reports[0]?.id || null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setBundle(null);
          setError(requestError.status === 403 ? '교수 역할만 리포트를 검토하고 공개할 수 있습니다.' : requestError.message);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spaceId, isAuthorized, reloadKey]);

  const reports = bundle?.reports || [];
  const selectedReport = reports.find((report) => report.id === selectedReportId) || null;
  const summary = useMemo(() => ({
    total: reports.length,
    ready: reports.filter((report) => report.status === 'DRAFT' && isPublishable(report)).length,
    published: reports.filter((report) => report.status === 'PUBLISHED').length,
    blocked: reports.filter((report) => report.status === 'INSUFFICIENT_DATA').length,
  }), [reports]);

  if (!isAuthorized) return <section className="permission-notice"><h1>접근 권한이 없습니다.</h1><p>리포트 검토와 공개는 스페이스 관리자(교수)만 할 수 있습니다.</p></section>;
  if (loading) return <section className="report-loading" aria-label="리포트 불러오는 중"><div/><div/><div/></section>;
  if (error) return <section className="dashboard-error" role="alert"><h1>리포트를 불러오지 못했습니다.</h1><p>{error}</p><button type="button" className="secondary-button" onClick={() => setReloadKey((current) => current + 1)}>다시 시도</button></section>;
  if (!bundle) return null;

  const handlePublish = async () => {
    if (!selectedReport) return;
    setPublishError('');
    setPublishing(true);
    try {
      const published = await publishReport(selectedReport.id);
      setBundle((current) => ({ ...current, reports: current.reports.map((report) => report.id === published.id ? published : report) }));
    } catch (requestError) {
      setPublishError(requestError.message || '리포트를 공개하지 못했습니다.');
    } finally {
      setPublishing(false);
    }
  };

  return <div className="report-review">
    <div className="page-heading"><div><h1>리포트 검토 및 공개</h1><p>팀별 계산 결과와 입력 완전성을 확인한 뒤 해당 팀 리포트를 공개하세요.</p></div></div>

    <section className="report-disclaimer"><strong>교수 판단 보조 자료</strong><span>이 리포트는 자동 성적이 아닌 교수 판단 보조 자료입니다.</span></section>

    <section className="report-summary" aria-label="리포트 상태 요약">
      <div><span>전체 팀</span><strong>{summary.total}<small>팀</small></strong></div>
      <div><span>공개 가능</span><strong>{summary.ready}<small>팀</small></strong></div>
      <div><span>공개 완료</span><strong>{summary.published}<small>팀</small></strong></div>
      <div><span>입력 부족</span><strong>{summary.blocked}<small>팀</small></strong></div>
    </section>

    {reports.length === 0 ? <section className="empty-state"><p>검토할 리포트가 없습니다.</p><span>평가 입력이 완료되면 팀별 초안이 표시됩니다.</span></section> : <div className="report-workspace">
      <aside className="report-team-nav" aria-label="팀별 리포트">
        <div className="section-heading"><h2>팀별 리포트</h2><span>{reports.length}개 팀</span></div>
        <div className="report-team-buttons">{reports.map((report) => <button key={report.id} type="button" className={report.id === selectedReportId ? 'is-selected' : ''} aria-pressed={report.id === selectedReportId} onClick={() => { setSelectedReportId(report.id); setPublishError(''); }}><span><strong>{report.teamName}</strong><small>{report.totalPercent == null ? '계산 대기' : `합계 ${report.totalPercent.toFixed(1)}%`}</small></span><StatusBadge status={report.status}/></button>)}</div>
      </aside>

      {selectedReport && <section className="report-detail-panel">
        <div className="report-detail-heading"><div><div className="report-title-line"><h2>{selectedReport.teamName}</h2><StatusBadge status={selectedReport.status}/></div><p>초안 생성 {formatDate(selectedReport.generatedAt)} · 정책 {selectedReport.policy.version}</p></div>{selectedReport.status === 'PUBLISHED' && <span className="published-date">공개 {formatDate(selectedReport.publishedAt)}</span>}</div>

        <div className="report-total-panel"><span>팀 기여도 합계</span><strong>{selectedReport.totalPercent == null ? '계산 대기' : `${selectedReport.totalPercent.toFixed(1)}%`}</strong><small>{selectedReport.totalPercent === 100 ? '팀 전체 합계가 100.0%입니다.' : '모든 입력이 완료된 뒤 합계를 확정합니다.'}</small></div>

        <section className="report-section"><div className="section-heading"><h2>입력 완전성</h2><span>공개 전 필수 확인</span></div><div className="completeness-grid"><CompletenessItem label="AI 작업" value={selectedReport.completeness.ai}/><CompletenessItem label="중간 평가" value={selectedReport.completeness.mid}/><CompletenessItem label="최종 평가" value={selectedReport.completeness.final}/></div></section>

        {(selectedReport.blockingReasons.length > 0 || selectedReport.excludedComponents.length > 0) && <section className="report-blocking" role="alert"><strong>공개할 수 없는 이유</strong><ul>{selectedReport.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}{selectedReport.excludedComponents.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>}

        <section className="report-section"><div className="section-heading"><h2>계산 상세</h2><span>{selectedReport.policy.label}</span></div><div className="report-member-table" role="table" aria-label={`${selectedReport.teamName} 팀원별 기여도`}><div className="report-table-row report-table-head" role="row"><span role="columnheader">팀원</span><span role="columnheader">AI 70%</span><span role="columnheader">중간 10%</span><span role="columnheader">최종 20%</span><span role="columnheader">최종 기여도</span></div>{selectedReport.members.map((member) => <div className="report-table-row" role="row" key={member.id}><strong role="cell">{member.name}</strong><span role="cell">{formatPoint(member.ai)}</span><span role="cell">{formatPoint(member.mid)}</span><span role="cell">{formatPoint(member.final)}</span><strong role="cell">{member.contributionPercent == null ? '-' : `${member.contributionPercent.toFixed(1)}%`}</strong></div>)}</div></section>

        <section className="publish-check"><div><h2>공개 전 확인</h2><p>학생에게는 팀원 전체의 최종 비율과 본인의 상세 근거만 공개됩니다.</p></div><ul><li className={selectedReport.totalPercent === 100 ? 'is-pass' : 'is-fail'}>팀 합계 100.0%</li><li className={isComplete(selectedReport) ? 'is-pass' : 'is-fail'}>필수 입력 완료</li><li className={selectedReport.blockingReasons.length === 0 ? 'is-pass' : 'is-fail'}>차단 사유 없음</li><li className="is-pass">정책 {selectedReport.policy.version}</li></ul><button type="button" className="primary-button" disabled={!isPublishable(selectedReport) || publishing} onClick={handlePublish}>{publishing ? '공개 중...' : selectedReport.status === 'PUBLISHED' ? '공개 완료' : selectedReport.status === 'INSUFFICIENT_DATA' ? '입력 완료 후 공개' : '이 팀 리포트 공개'}</button>{publishError && <p className="form-error" role="alert">{publishError}</p>}</section>
      </section>}
    </div>}
  </div>;
}

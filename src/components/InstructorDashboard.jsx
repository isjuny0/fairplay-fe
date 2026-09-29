import { useEffect, useState } from 'react';
import { getInstructorDashboard } from '../api/instructorDashboard.js';

const teamStatusLabels = {
  ON_TRACK: '정상 진행',
  ATTENTION: '확인 필요',
};

function SummaryCard({ label, value, unit, tone = 'default', onClick, expanded }) {
  const content = <><span>{label}</span><strong>{value}<small>{unit}</small></strong>{onClick && <em>{expanded ? '접기' : '목록 보기'}</em>}</>;
  if (!onClick) return <div className={`summary-card tone-${tone}`}>{content}</div>;
  return <button type="button" className={`summary-card tone-${tone}`} onClick={onClick} aria-expanded={expanded} aria-controls="dashboard-issue-detail">{content}</button>;
}

function IssueDetail({ type, dashboard }) {
  if (type === 'unassigned') {
    return <section className="issue-detail" id="dashboard-issue-detail"><div><h2>팀 미가입 사용자</h2><p>아직 팀에 가입하지 않은 스페이스 참여자입니다.</p></div>{dashboard.unassignedMembers.length === 0 ? <p className="compact-empty">미가입 사용자가 없습니다.</p> : <ul>{dashboard.unassignedMembers.map((member) => <li key={member.id}><strong>{member.name}</strong><span>팀 미가입</span></li>)}</ul>}</section>;
  }

  return <section className="issue-detail" id="dashboard-issue-detail"><div><h2>평가 미제출 현황</h2><p>제출이 완료되지 않은 팀과 구성원입니다.</p></div>{dashboard.missingEvaluations.length === 0 ? <p className="compact-empty">미제출 평가가 없습니다.</p> : <ul>{dashboard.missingEvaluations.map((evaluation) => <li key={evaluation.id}><strong>{evaluation.teamName} · {evaluation.roundName}</strong><span>{evaluation.members.join(', ')}</span></li>)}</ul>}</section>;
}

export default function InstructorDashboard({ spaceId, isAuthorized }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!spaceId || !isAuthorized) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedIssue(null);

    getInstructorDashboard(spaceId)
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setDashboard(null);
          setError(requestError.status === 403 ? '교수 역할만 이 대시보드를 확인할 수 있습니다.' : requestError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId, isAuthorized, reloadKey]);

  if (!isAuthorized) {
    return <section className="permission-notice"><h1>접근 권한이 없습니다.</h1><p>이 화면은 스페이스 관리자(교수)만 확인할 수 있습니다.</p></section>;
  }

  if (loading) return <section className="dashboard-loading" aria-label="교수 대시보드 불러오는 중"><div/><div/><div/></section>;

  if (error) {
    return <section className="dashboard-error" role="alert"><h1>대시보드를 불러오지 못했습니다.</h1><p>{error}</p><button type="button" className="secondary-button" onClick={() => setReloadKey((current) => current + 1)}>다시 시도</button></section>;
  }

  if (!dashboard) return null;

  const hasNoData = dashboard.teams.length === 0 && dashboard.unassignedMembers.length === 0;
  if (hasNoData) {
    return <><div className="page-heading"><div><h1>교수 대시보드</h1><p>스페이스의 팀 진행 현황을 확인하세요.</p></div></div><section className="empty-state"><p>표시할 진행 현황이 없습니다.</p><span>학생이 스페이스에 참가하면 이곳에 현황이 표시됩니다.</span></section></>;
  }

  const toggleIssue = (issue) => setSelectedIssue((current) => (current === issue ? null : issue));

  return <div className="instructor-dashboard">
    <div className="page-heading"><div><h1>교수 대시보드</h1></div></div>

    <section className="summary-grid" aria-label="진행 현황 요약">
      <SummaryCard label="전체 팀" value={dashboard.summary.teamCount} unit="팀"/>
      <SummaryCard label="평균 진행률" value={dashboard.summary.averageProgress} unit="%"/>
      <SummaryCard label="팀 미가입" value={dashboard.summary.unassignedCount} unit="명" tone="warning" onClick={() => toggleIssue('unassigned')} expanded={selectedIssue === 'unassigned'}/>
      <SummaryCard label="평가 미제출" value={dashboard.summary.missingEvaluationCount} unit="명" tone="warning" onClick={() => toggleIssue('evaluation')} expanded={selectedIssue === 'evaluation'}/>
    </section>

    {selectedIssue && <IssueDetail type={selectedIssue} dashboard={dashboard}/>}

    <section className="dashboard-section"><div className="section-heading"><h2>팀별 진행률</h2><span>{dashboard.teams.length}개 팀</span></div><ul className="progress-list">{dashboard.teams.map((team) => <li key={team.id}><div className="progress-team"><div><strong>{team.name}</strong><span>{team.memberCount}명</span></div><span className={`status-badge ${team.status === 'ATTENTION' ? 'status-pending' : 'status-open'}`}>{teamStatusLabels[team.status] || '상태 확인'}</span></div><p className="progress-members">{team.members?.join(', ')}</p><div className="progress-row"><div className="progress-track" aria-label={`${team.name} 진행률 ${team.progressPercent}%`}><span style={{ width: `${team.progressPercent}%` }}/></div><strong>{team.progressPercent}%</strong></div><div className="progress-meta"><span>승인 대기 {team.pendingApprovals}건</span><span>평가 미제출 {team.missingEvaluations}명</span></div></li>)}</ul></section>
  </div>;
}

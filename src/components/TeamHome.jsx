import { useEffect, useState } from 'react';
import { getTeamHome } from '../api/teamHome.js';

const roleLabels = { LEADER: '팀장', DEPUTY: '부리더', MEMBER: '팀원' };
const taskStatusLabels = { TODO: '할 일', IN_PROGRESS: '진행 중', PENDING_APPROVAL: '승인 대기', DONE: '완료' };
const roundTypeLabels = { MID: '중간 동료 평가', FINAL: '최종 동료 평가' };
const roundStatusLabels = { DRAFT: '예정', OPEN: '진행 중', CLOSED: '종료' };

function formatDate(value, includeTime = false) {
  if (!value) return '미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '미정';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short', day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function TeamHome({ spaceId, team, userId, onNavigate }) {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!spaceId || !team?.id) {
      setHome(null);
      setError('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    getTeamHome({ spaceId, team, userId })
      .then((result) => { if (!cancelled) setHome(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || '팀 홈을 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spaceId, team, userId, reloadKey]);

  if (!team) {
    return <section className="empty-state"><p>참여 중인 팀이 없습니다.</p><span>팀 목록에서 팀에 참가하거나 새 팀을 만들어 주세요.</span></section>;
  }

  if (loading) {
    return <section className="team-home-loading" aria-label="팀 홈 불러오는 중"><div/><div/><div/></section>;
  }

  if (error) {
    return <section className="dashboard-error" role="alert"><strong>팀 홈을 불러오지 못했습니다.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)}>다시 시도</button></section>;
  }

  if (!home) return null;

  const { nextAction, recentTasks, evaluationRounds, evaluationAvailable } = home;
  return <section className="team-home">
    <div className="page-heading">
      <div><h1>{home.team.name} 팀 홈</h1><p>내 역할과 다음 할 일, 가까운 일정을 확인하세요.</p></div>
      <div className="team-home-heading-actions"><button type="button" className="secondary-button" onClick={() => onNavigate('팀원 관리')}>팀원 관리</button><span className="team-role-badge">내 역할 · {roleLabels[home.team.myRole] || '팀원'}</span></div>
    </div>

    <section className="next-action-card" aria-labelledby="next-action-title">
      <div className="next-action-copy">
        <span className={nextAction?.priority === 'HIGH' ? 'priority-badge is-high' : 'priority-badge'}>{nextAction?.priority === 'HIGH' ? '우선 확인' : '다음 할 일'}</span>
        <h2 id="next-action-title">{nextAction?.title || '현재 진행할 작업이 없습니다.'}</h2>
        <p>{nextAction?.description || '새 작업이 등록되면 이곳에 표시됩니다.'}</p>
        {nextAction?.dueAt && <span className="next-action-deadline">마감 {formatDate(nextAction.dueAt, true)}</span>}
      </div>
      {nextAction && <button type="button" className="primary-button" onClick={() => onNavigate(nextAction.targetMenu)}>{nextAction.actionLabel}</button>}
    </section>

    <div className="team-home-grid">
      <section className="team-home-panel" aria-labelledby="recent-task-title">
        <div className="section-heading"><h2 id="recent-task-title">최근 작업</h2><button type="button" className="text-button" onClick={() => onNavigate('작업')}>전체 보기</button></div>
        {recentTasks.length === 0 ? <p className="panel-empty">등록된 작업이 없습니다.</p> : <ul className="recent-task-list">{recentTasks.map((task) => <li key={task.id}>
          <div><strong>{task.title}</strong><span>{task.assignees?.map((assignee) => assignee.name).join(', ') || '담당자 없음'} · 가중치 {task.weight}</span></div>
          <div className="task-side"><span className={`task-status status-${task.status.toLowerCase().replace('_', '-')}`}>{taskStatusLabels[task.status] || task.status}</span><time dateTime={task.dueAt}>{formatDate(task.dueAt)}</time></div>
        </li>)}</ul>}
      </section>

      <section className="team-home-panel" aria-labelledby="evaluation-title">
        <div className="section-heading"><h2 id="evaluation-title">평가 일정</h2><button type="button" className="text-button" onClick={() => onNavigate('동료 평가')}>평가 보기</button></div>
        {!evaluationAvailable ? <p className="panel-empty">평가 일정 API가 준비되면 표시됩니다.</p> : evaluationRounds.length === 0 ? <p className="panel-empty">예정된 평가가 없습니다.</p> : <ul className="evaluation-list">{evaluationRounds.map((round) => <li key={round.id}>
          <div><strong>{roundTypeLabels[round.type] || round.type}</strong><span>{formatDate(round.opensAt)} – {formatDate(round.closesAt)}</span></div>
          <span className={`round-status status-${round.status.toLowerCase()}`}>{roundStatusLabels[round.status] || round.status}</span>
        </li>)}</ul>}
      </section>
    </div>
  </section>;
}

export default TeamHome;

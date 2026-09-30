import { useCallback, useEffect, useState } from 'react';
import { assignTeamDeputy, getTeamMembers, reviewTeamApplication } from '../api/teamMembers.js';

const roleLabels = { LEADER: '팀장', DEPUTY: '부리더', MEMBER: '팀원', INSTRUCTOR: '교수' };

function formatDate(value) {
  if (!value) return '일시 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일시 미정';
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function TeamMembers({ team, viewerRole }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const load = useCallback(async () => {
    if (!team?.id) return;
    setLoading(true);
    setError('');
    try {
      setData(await getTeamMembers({ teamId: team.id, viewerRole }));
    } catch (requestError) {
      setError(requestError.message || '팀원 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [team?.id, viewerRole]);

  useEffect(() => { load(); }, [load]);

  if (!team) {
    return <section className="empty-state"><p>참여 중인 팀이 없습니다.</p><span>팀에 가입한 뒤 팀원과 권한을 확인할 수 있습니다.</span></section>;
  }

  if (loading && !data) {
    return <section className="member-management-loading" aria-label="팀원 정보 불러오는 중"><div/><div/><div/></section>;
  }

  if (error && !data) {
    return <section className="dashboard-error" role="alert"><strong>팀원 정보를 불러오지 못했습니다.</strong><p>{error}</p><button type="button" className="secondary-button" onClick={load}>다시 시도</button></section>;
  }

  const canManage = data?.viewerRole === 'LEADER';
  const members = data?.members || [];
  const applications = data?.applications || [];

  const review = async (applicationId, decision) => {
    setPendingAction(`${applicationId}-${decision}`);
    setError('');
    try {
      await reviewTeamApplication({ teamId: team.id, applicationId, decision });
      await load();
    } catch (requestError) {
      setError(requestError.message || '가입 신청을 처리하지 못했습니다.');
    } finally {
      setPendingAction('');
    }
  };

  const assignDeputy = async (userId) => {
    setPendingAction(`deputy-${userId}`);
    setError('');
    try {
      await assignTeamDeputy({ teamId: team.id, userId });
      await load();
    } catch (requestError) {
      setError(requestError.message || '부리더를 지정하지 못했습니다.');
    } finally {
      setPendingAction('');
    }
  };

  return <section className="member-management">
    <div className="page-heading">
      <div><h1>팀원·권한 관리</h1><p>{team.name}의 구성원과 가입 신청 상태를 확인하세요.</p></div>
      <span className="team-role-badge">내 역할 · {roleLabels[data?.viewerRole] || '팀원'}</span>
    </div>

    {!canManage && <div className="permission-banner"><strong>조회 전용</strong><span>가입 승인과 부리더 지정은 팀장만 할 수 있습니다.</span></div>}
    {error && <div className="inline-error" role="alert"><span>{error}</span><button type="button" onClick={load}>다시 시도</button></div>}

    <div className="member-management-grid">
      <section className="management-panel" aria-labelledby="member-list-title">
        <div className="section-heading"><h2 id="member-list-title">팀원</h2><span>{members.length}명</span></div>
        {members.length === 0 ? <p className="panel-empty">등록된 팀원이 없습니다.</p> : <ul className="member-list">{members.map((member) => {
          const memberRole = member.role || 'MEMBER';
          return <li key={member.userId}>
          <div className="member-identity"><span className="member-avatar" aria-hidden="true">{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><span>가입 {formatDate(member.joinedAt)}</span></div></div>
          <div className="member-role-actions"><span className={`member-role role-${memberRole.toLowerCase()}`}>{roleLabels[memberRole] || memberRole}</span>{canManage && memberRole === 'MEMBER' && <button type="button" className="secondary-button compact-button" disabled={Boolean(pendingAction)} onClick={() => assignDeputy(member.userId)}>{pendingAction === `deputy-${member.userId}` ? '지정 중...' : '부리더 지정'}</button>}</div>
        </li>;
        })}</ul>}
      </section>

      <section className="management-panel" aria-labelledby="application-list-title">
        <div className="section-heading"><h2 id="application-list-title">가입 신청</h2><span>{applications.length}건</span></div>
        {applications.length === 0 ? <p className="panel-empty">대기 중인 가입 신청이 없습니다.</p> : <ul className="application-list">{applications.map((application) => <li key={application.id}>
          <div><strong>{application.name}</strong><span>{formatDate(application.requestedAt)} 신청</span></div>
          {canManage ? <div className="application-actions"><button type="button" className="secondary-button compact-button" disabled={Boolean(pendingAction)} onClick={() => review(application.id, 'REJECTED')}>{pendingAction === `${application.id}-REJECTED` ? '처리 중...' : '거절'}</button><button type="button" className="primary-button compact-button" disabled={Boolean(pendingAction)} onClick={() => review(application.id, 'APPROVED')}>{pendingAction === `${application.id}-APPROVED` ? '처리 중...' : '승인'}</button></div> : <span className="status-badge status-pending">승인 대기</span>}
        </li>)}</ul>}
      </section>
    </div>
  </section>;
}

export default TeamMembers;

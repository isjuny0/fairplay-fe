import { useEffect, useRef, useState } from 'react';
import { buildingLabels, teamBuildingCountdown, formatDate } from '../lib/domain.js';
import Icon from './Icon.jsx';
import TeamMemberCount from './TeamMemberCount.jsx';
import { ErrorNotice } from './ui.jsx';
import '../space-home.css';

function Period({ label, start, end, countdown }) {
  return (
    <div className="space-home-period">
      <dt>{label}</dt>
      <dd className="space-home-dates">
        {start && end ? (
          <>
            <time dateTime={start}>{formatDate(start)}</time>
            <span aria-hidden="true">~</span>
            <time dateTime={end}>{formatDate(end)}</time>
            {countdown && <span className="space-home-countdown">{countdown}</span>}
          </>
        ) : <span>기간 미설정</span>}
      </dd>
    </div>
  );
}

function SpaceSchedule({ space }) {
  const [now, setNow] = useState(Date.now);
  const start = Date.parse(space.teamBuildingOpensAt);
  const end = Date.parse(space.teamBuildingClosesAt);
  const closed = Number.isFinite(end) && now >= end;
  useEffect(() => {
    setNow(Date.now());
    if (!Number.isFinite(end) || end <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [end, closed]);
  const canBuild = ['OPEN', 'SCHEDULED'].includes(space.teamBuildingStatus);
  const inPeriod = canBuild && start <= now && now < end;
  const status = inPeriod
    ? '진행중'
    : (canBuild && closed) || ['CLOSED', 'LOCKED'].includes(space.teamBuildingStatus)
      ? '고정'
      : buildingLabels[space.teamBuildingStatus] || '상태 확인 중';
  return (
    <section className="space-home-periods" aria-label="프로젝트 일정">
      <div className="space-home-period-summary">
        <h2>팀 구성</h2>
        <p className={`space-home-period-status ${inPeriod ? 'is-open' : ''}`}>
          <span className="space-home-building-dot" aria-hidden="true" />
          {status}
        </p>
      </div>
      <dl className="space-home-period-details">
        <Period label="프로젝트 기간" start={space.startAt} end={space.endAt} />
        <Period
          label="팀 빌딩 기간"
          start={space.teamBuildingOpensAt}
          end={space.teamBuildingClosesAt}
          countdown={teamBuildingCountdown(space.teamBuildingClosesAt, now)}
        />
      </dl>
    </section>
  );
}

export default function SpaceHome({
  space, teams, joinedTeam, user, directoryReady, buildingOpen,
  loading, busy, error, directoryError, teamCreationRestriction,
  onReload, onCreate, onOpenTeam, onApply,
}) {
  const isManager = space.myRole === 'MANAGER';
  const otherTeams = teams.filter((team) => team.id !== joinedTeam?.id);
  const [showCreateHint, setShowCreateHint] = useState(false);
  const createHintTimer = useRef(null);
  useEffect(() => {
    setShowCreateHint(false);
    window.clearTimeout(createHintTimer.current);
    return () => window.clearTimeout(createHintTimer.current);
  }, [space.id, teamCreationRestriction]);
  const createHint = joinedTeam
    ? `이미 ${joinedTeam.name} 팀에 소속되어 있습니다.`
    : teamCreationRestriction;
  return (
    <section className="space-home" aria-label="스페이스 홈">
      <header className="space-home-intro">
        <span className="space-home-eyebrow">스페이스 홈</span>
        <div className="space-home-title-row">
          <h1>{space.name}</h1>
        </div>
        {space.description && <p>스페이스 소개: {space.description}</p>}
      </header>

      <SpaceSchedule space={space} />

      <ErrorNotice error={error} onRetry={onReload} />
      <ErrorNotice error={directoryError} onRetry={onReload} />
      <section className="space-home-own-team" aria-labelledby="space-own-team-heading">
        <h2 id="space-own-team-heading">내 팀</h2>
        {joinedTeam ? (
          <div className="space-home-own-card">
            <button
              type="button"
              className="space-home-card-open"
              aria-label={`${joinedTeam.name} 팀 홈으로 이동`}
              onClick={() => onOpenTeam(joinedTeam)}
            />
            <span className="space-home-team-icon" aria-hidden="true"><Icon name="users" /></span>
            <span className="space-home-team-copy">
              <span className="space-home-team-name">{joinedTeam.name}</span>
              <span className="space-home-team-meta">
                <TeamMemberCount team={joinedTeam} />
                <span>{joinedTeam.leaderId === user.id ? '팀 리더' : '팀원'}</span>
              </span>
            </span>
            <span className="space-home-team-indicator" aria-hidden="true">
              <Icon name="home" />
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path d="M4 2L9 8L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        ) : (
          <div className="space-home-empty" role={!directoryReady && !directoryError ? 'status' : undefined}>
            <Icon name="users" />
            <p>{directoryError
              ? '팀 정보를 다시 불러와 주세요.'
              : !directoryReady
                ? '팀 정보를 확인하고 있습니다.'
                : '팀에 가입해 주세요.'}</p>
          </div>
        )}
      </section>

      <section className="space-home-other-teams" aria-labelledby="space-other-teams-heading">
        <div className="space-home-section-heading">
          <h2 id="space-other-teams-heading">팀 목록 <span>{otherTeams.length}</span></h2>
          <div className="space-home-actions">
            <button
              className="secondary-button space-home-refresh"
              aria-label="팀 목록 새로고침"
              title="새로고침"
              disabled={loading || busy}
              onClick={onReload}
            ><Icon name="refresh" /></button>
            <button
              className="primary-button"
              disabled={busy || loading || !directoryReady}
              aria-describedby={showCreateHint && createHint ? 'team-create-restriction' : undefined}
              onClick={() => {
                window.clearTimeout(createHintTimer.current);
                if (teamCreationRestriction) {
                  setShowCreateHint(true);
                  createHintTimer.current = window.setTimeout(() => {
                    setShowCreateHint(false);
                    createHintTimer.current = null;
                  }, 1000);
                  return;
                }
                setShowCreateHint(false);
                onCreate();
              }}
            ><Icon name="plus" />팀 만들기</button>
          </div>
          {showCreateHint && createHint && (
            <p id="team-create-restriction" className="space-home-action-hint" role="status">{createHint}</p>
          )}
        </div>
        {otherTeams.length ? (
          <ul className="space-home-team-grid" aria-label="팀 목록">
            {otherTeams.map((team) => {
              const pending = team.myMembershipStatus === 'PENDING';
              const rejected = team.myMembershipStatus === 'REJECTED';
              const restriction = !directoryReady
                ? '팀 정보를 확인하고 있습니다.'
                : joinedTeam
                  ? `이미 ${joinedTeam.name} 팀에 소속되어 있습니다. 스페이스에서는 한 팀에만 소속될 수 있습니다.`
                  : !buildingOpen
                    ? teamCreationRestriction
                    : !team.canApply
                      ? '현재 팀 가입 신청을 할 수 없습니다.'
                      : '';
              return (
                <li className="space-home-team-card" key={team.id}>
                  <div className="space-home-other-team-top">
                    <span className="space-home-team-icon" aria-hidden="true"><Icon name="users" /></span>
                    {!isManager && (pending || rejected) && (
                      <span className={`space-home-application ${pending ? 'is-pending' : 'is-rejected'}`}>
                        {pending ? '가입 승인 대기' : '가입 신청 반려'}
                      </span>
                    )}
                  </div>
                  <h3>{team.name}</h3>
                  <div className="space-home-other-team-bottom">
                    <TeamMemberCount team={team} />
                    {isManager ? (
                      <button className="secondary-button" onClick={() => onOpenTeam(team)}>팀 자료 조회 <Icon name="arrow" /></button>
                    ) : !pending && (
                      <button
                        className="secondary-button"
                        disabled={busy || Boolean(restriction)}
                        title={restriction || undefined}
                        aria-describedby={restriction ? `team-join-restriction-${team.id}` : undefined}
                        aria-label={`${team.name} ${rejected ? '다시 신청' : '가입 신청'}`}
                        onClick={() => onApply(team)}
                      >{rejected ? '다시 신청' : '가입 신청'}<Icon name="arrow" /></button>
                    )}
                  </div>
                  {!isManager && !pending && restriction && (
                    <span className="sr-only" id={`team-join-restriction-${team.id}`}>{restriction}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : directoryReady && (
          <div className="space-home-empty">
            <Icon name="users" />
            <p>{joinedTeam ? '아직 다른 팀이 없습니다.' : '아직 만들어진 팀이 없습니다.'}</p>
          </div>
        )}
      </section>
    </section>
  );
}

import { apiTimeToEpoch } from '../lib/koreanTime.js';
import { useEffect, useState } from 'react';
import {
  buildingLabels,
  teamBuildingCountdown,
  formatDate,
} from '../lib/domain.js';
import Icon from './Icon.jsx';
import RefreshButton from './RefreshButton.jsx';
import TeamMemberCount from './TeamMemberCount.jsx';
import SpaceAnnouncementSummary from './SpaceAnnouncementSummary.jsx';
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
            {countdown && (
              <span className="space-home-countdown">{countdown}</span>
            )}
          </>
        ) : (
          <span>기간 미설정</span>
        )}
      </dd>
    </div>
  );
}

function SpaceSchedule({ space }) {
  const [now, setNow] = useState(Date.now);
  const start = apiTimeToEpoch(space.teamBuildingOpensAt);
  const end = apiTimeToEpoch(space.teamBuildingClosesAt);
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
    : (canBuild && closed) ||
        ['CLOSED', 'LOCKED'].includes(space.teamBuildingStatus)
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
  space,
  teams,
  joinedTeam,
  user,
  directoryReady,
  buildingOpen,
  loading,
  busy,
  error,
  directoryError,
  teamCreationRestriction,
  onReload,
  onCreate,
  onOpenTeam,
  onApply,
  onCancelApplication,
}) {
  const isManager = space.myRole === 'MANAGER';
  const otherTeams = teams.filter((team) => team.id !== joinedTeam?.id);
  const [teamSearch, setTeamSearch] = useState('');
  const visibleTeams = otherTeams.filter((team) =>
    team.name
      .toLocaleLowerCase()
      .includes(teamSearch.trim().toLocaleLowerCase()),
  );
  const pendingTeam = teams.find(
    (team) => team.myMembershipStatus === 'PENDING',
  );
  return (
    <section className="space-home" aria-label="스페이스 홈">
      <header className="space-home-intro space-page-header">
        <div className="space-page-heading">
          <span className="space-home-eyebrow space-page-eyebrow">
            스페이스 홈
          </span>
          <div className="space-home-title-row">
            <h1>{space.name}</h1>
          </div>
        </div>
        <p
          className="space-page-description"
          aria-hidden={!space.description || undefined}
        >
          {space.description ? `소개: ${space.description}` : ''}
        </p>
      </header>

      <SpaceSchedule space={space} />
      <SpaceAnnouncementSummary key={space.id} space={space} />

      <ErrorNotice error={error} onRetry={onReload} />
      <ErrorNotice error={directoryError} onRetry={onReload} />
      <section
        className="space-home-own-team"
        aria-labelledby="space-own-team-heading"
      >
        <h2 id="space-own-team-heading">내 팀</h2>
        {joinedTeam ? (
          <div className="space-home-own-card">
            <button
              type="button"
              className="space-home-card-open"
              aria-label={`${joinedTeam.name} 팀 홈으로 이동`}
              onClick={() => onOpenTeam(joinedTeam)}
            />
            <span className="space-home-team-icon" aria-hidden="true">
              <Icon name="team" />
            </span>
            <span className="space-home-team-copy">
              <span className="space-home-team-name">{joinedTeam.name}</span>
              <span className="space-home-team-meta">
                <TeamMemberCount team={joinedTeam} />
                <span>
                  {joinedTeam.leaderId === user.id ? '팀 리더' : '팀원'}
                </span>
              </span>
            </span>
            <span className="space-home-team-indicator" aria-hidden="true">
              <Icon name="team" />
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path
                  d="M4 2L9 8L4 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        ) : directoryReady && !directoryError && pendingTeam ? (
          <div
            className="space-home-empty space-home-pending-card"
            role="status"
          >
            <p>
              팀 가입승인 대기 상태 이므로 팀을 만들 수 없습니다. 팀을 만드려면
              신청 취소 해주세요
            </p>
          </div>
        ) : directoryReady && !directoryError ? (
          <button
            type="button"
            className="space-home-empty space-home-create-card"
            aria-label="팀 만들기"
            aria-describedby={
              teamCreationRestriction ? 'team-create-restriction' : undefined
            }
            disabled={busy || loading || Boolean(teamCreationRestriction)}
            onClick={onCreate}
          >
            <span className="space-home-create-label">
              <Icon name="plus" />팀 만들기
            </span>
            {teamCreationRestriction && (
              <span
                id="team-create-restriction"
                className="space-home-create-restriction"
              >
                {teamCreationRestriction}
              </span>
            )}
          </button>
        ) : (
          <div
            className="space-home-empty"
            role={!directoryReady && !directoryError ? 'status' : undefined}
          >
            <Icon name="team" />
            <p>
              {directoryError
                ? '팀 정보를 다시 불러와 주세요.'
                : '팀 정보를 확인하고 있습니다.'}
            </p>
          </div>
        )}
      </section>

      <section
        className="space-home-other-teams"
        aria-labelledby="space-other-teams-heading"
      >
        <div className="directory-toolbar space-home-team-toolbar space-home-section-heading">
          <h2 id="space-other-teams-heading">
            팀 목록 <span>{otherTeams.length}</span>
          </h2>
          <label className="directory-search">
            <span className="sr-only">팀 이름 검색</span>
            <input
              type="search"
              placeholder="팀 이름 검색"
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
            />
          </label>
          <div className="space-home-actions">
            <RefreshButton
              className="space-home-refresh"
              label="팀 목록 새로고침"
              disabled={loading || busy}
              onClick={onReload}
            />
          </div>
        </div>
        <div className="space-home-team-columns" aria-hidden="true">
          <span>팀</span>
          <span>인원</span>
          <span>가입 상태</span>
          <span />
        </div>
        {otherTeams.length ? (
          <ul className="space-home-team-list" aria-label="팀 목록">
            {visibleTeams.map((team) => {
              const pending = team.myMembershipStatus === 'PENDING';
              const rejected = team.myMembershipStatus === 'REJECTED';
              const restriction = !directoryReady
                ? '팀 정보를 확인하고 있습니다.'
                : joinedTeam
                  ? `이미 ${joinedTeam.name} 팀에 소속되어 있습니다. 스페이스에서는 한 팀에만 소속될 수 있습니다.`
                  : pendingTeam && !pending
                    ? `${pendingTeam.name} 팀 가입 신청이 대기 중입니다. 신청을 취소하면 다른 팀에 신청할 수 있습니다.`
                    : !buildingOpen
                      ? teamCreationRestriction
                      : !team.canApply
                        ? '현재 팀 가입 신청을 할 수 없습니다.'
                        : '';
              return (
                <li className="space-home-team-row" key={team.id}>
                  <div className="space-home-team-row-info space-home-team-name-cell">
                    <span className="space-home-team-icon" aria-hidden="true">
                      <Icon name="team" />
                    </span>
                    <h3>{team.name}</h3>
                  </div>
                  <TeamMemberCount team={team} />
                  <div className="space-home-team-row-state">
                    {(isManager || pending || rejected || !directoryReady) && (
                      <span
                        className={`space-home-membership${!isManager && pending ? ' is-pending' : !isManager && rejected ? ' is-rejected' : ''}`}
                      >
                        {isManager
                          ? '관리자 조회'
                          : pending
                            ? '가입 승인 대기'
                            : rejected
                              ? '가입 신청 반려'
                              : '확인 중'}
                      </span>
                    )}
                    {!isManager && !pending && !rejected && directoryReady && (
                      <span className="space-home-membership">—</span>
                    )}
                  </div>
                  <div className="space-home-team-row-action">
                    {isManager ? (
                      <button
                        className="secondary-button"
                        onClick={() => onOpenTeam(team)}
                      >
                        팀 자료 조회
                      </button>
                    ) : (
                      <button
                        className="primary-button space-home-team-button"
                        disabled={
                          busy ||
                          loading ||
                          !directoryReady ||
                          (!pending && Boolean(restriction))
                        }
                        title={(!pending && restriction) || undefined}
                        aria-describedby={
                          !pending && restriction
                            ? `team-join-restriction-${team.id}`
                            : undefined
                        }
                        aria-label={`${team.name} ${pending ? '신청 취소' : rejected ? '다시 신청' : '가입 신청'}`}
                        onClick={() =>
                          pending ? onCancelApplication(team) : onApply(team)
                        }
                      >
                        {pending
                          ? '신청 취소'
                          : rejected
                            ? '다시 신청'
                            : '가입 신청'}
                      </button>
                    )}
                  </div>
                  {!isManager && !pending && restriction && (
                    <span
                      className="sr-only"
                      id={`team-join-restriction-${team.id}`}
                    >
                      {restriction}
                    </span>
                  )}
                </li>
              );
            })}
            {!visibleTeams.length && (
              <li className="space-home-team-no-results">
                검색한 팀이 없습니다.
              </li>
            )}
          </ul>
        ) : (
          directoryReady && (
            <div className="space-home-empty">
              <Icon name="team" />
              <p>
                {joinedTeam
                  ? '아직 다른 팀이 없습니다.'
                  : '아직 만들어진 팀이 없습니다.'}
              </p>
            </div>
          )
        )}
      </section>
    </section>
  );
}

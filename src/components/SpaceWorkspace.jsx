import Icon from './Icon.jsx';
import { useState } from 'react';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getSpace } from '../api/spaces.js';
import {
  createTeam,
  getTeam,
  getTeamMembers,
  listTeams,
  requestTeamJoin,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { buildingLabels, formatDate, isApprovedMember } from '../lib/domain.js';
import SpaceSettings from './SpaceSettings.jsx';
import TeamWorkspace from './TeamWorkspace.jsx';
import UnavailablePage from './UnavailablePage.jsx';
import { spacePath, teamMenuPath } from '../lib/routes.js';
import ManagerDashboard from './ManagerDashboard.jsx';
import RoundManagement from './RoundManagement.jsx';
import ReportReview from './ReportReview.jsx';
import MemberContributions from './MemberContributions.jsx';
import WorkspaceNavigation from './WorkspaceNavigation.jsx';
import {
  EmptyState,
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

export default function SpaceWorkspace({
  spaceId,
  teamId,
  taskId,
  user,
  view,
  teamMenu,
  targetUserId,
  onBack,
}) {
  const navigate = useAppNavigate();
  const resource = useResource(async () => {
    const [space, teams] = await Promise.all([
      getSpace(spaceId),
      listTeams(spaceId),
    ]);
    const details = await Promise.all(teams.map((team) => getTeam(team.id)));
    return {
      space,
      teams: details,
      teamContexts:
        space.myRole === 'MANAGER'
          ? await Promise.all(
              details.map(async (team) => ({
                team,
                members: await getTeamMembers(team.id),
              })),
            )
          : [],
    };
  }, [spaceId]);
  const menu = view === 'settings' ? '스페이스 관리' : '팀 목록';
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const space = resource.data?.space;
  const teams = resource.data?.teams || [];
  const isManager = space?.myRole === 'MANAGER';
  const managerContext = {
    space,
    user,
    manager: true,
    teamContexts: resource.data?.teamContexts || [],
  };
  const managerView = [
    'settings',
    'dashboard',
    'rounds',
    'reports',
    'contributions',
  ].includes(view);
  const team = teams.find((item) => item.id === teamId);
  const joinedTeam = teams.find(isApprovedMember);
  const teamRole = !team
    ? ''
    : team.leaderId === user.id
      ? '리더'
      : team.deputyId === user.id
        ? '부리더'
        : isApprovedMember(team)
          ? '팀원'
          : '관리자 조회';
  const contentLayout =
    view === 'dashboard' ||
    (view === 'team' &&
      ['팀 홈', '작업 보드', '승인 검토', '팀원 관리'].includes(teamMenu))
      ? 'content-wide'
      : view === 'settings' || (view === 'team' && teamMenu === '팀 설정')
        ? 'content-settings'
        : 'content-reading';
  const buildingOpen =
    space?.teamBuildingStatus === 'OPEN' &&
    new Date(space.teamBuildingOpensAt) <= new Date() &&
    new Date(space.teamBuildingClosesAt) > new Date();
  const apply = async (target) => {
    setBusy(true);
    setError(null);
    try {
      await requestTeamJoin(target.id);
      resource.reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createTeam(spaceId, name.trim());
      setCreating(false);
      resource.reload();
      navigate(teamMenuPath(spaceId, created.id, '팀 홈'));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="workspace">
      <WorkspaceNavigation
        space={space}
        spaceId={spaceId}
        teams={teams}
        team={team}
        view={view}
        teamMenu={teamMenu}
        teamRole={teamRole}
        user={user}
        onBack={onBack}
      />
      <main className={`main-content ${contentLayout}`}>
        <ResourceState resource={resource}>
          {space && (
            <>
              <nav className="workspace-breadcrumb" aria-label="현재 위치">
                <button onClick={() => navigate(spacePath(spaceId))}>
                  {space.name}
                </button>
                {team && (
                  <>
                    <span aria-hidden="true">/</span>
                    <button
                      onClick={() =>
                        navigate(
                          teamMenuPath(
                            spaceId,
                            team.id,
                            isApprovedMember(team) ? '팀 홈' : '팀원 관리',
                          ),
                        )
                      }
                    >
                      {team.name}
                    </button>
                  </>
                )}
                <span aria-hidden="true">/</span>
                <span aria-current="page">
                  {view === 'team'
                    ? taskId
                      ? teamMenu === '승인 검토'
                        ? '승인 검토 상세'
                        : '작업 상세'
                      : teamMenu
                    : {
                        teams: '팀 목록',
                        dashboard: '관리자 대시보드',
                        rounds: '평가 회차 관리',
                        reports: '리포트 검토·공개',
                        settings: '스페이스 관리',
                        contributions: '팀원 수행 상세',
                      }[view]}
                </span>
                {team && (
                  <span className="role-badge breadcrumb-role">{teamRole}</span>
                )}
              </nav>
              {managerView && !isManager ? (
                <UnavailablePage
                  title="스페이스 관리 권한이 없습니다."
                  description="스페이스 관리자만 이 화면을 사용할 수 있습니다."
                />
              ) : view === 'dashboard' ? (
                <ManagerDashboard context={managerContext} />
              ) : view === 'rounds' ? (
                <RoundManagement context={managerContext} />
              ) : view === 'reports' ? (
                <ReportReview context={managerContext} />
              ) : view === 'contributions' && team ? (
                <MemberContributions
                  context={{
                    ...managerContext,
                    team,
                    members:
                      managerContext.teamContexts.find(
                        (entry) => entry.team.id === team.id,
                      )?.members || [],
                  }}
                  targetUserId={targetUserId}
                  onBack={() => navigate(`${spacePath(spaceId)}/dashboard`)}
                />
              ) : view === 'contributions' ? (
                <UnavailablePage title="팀을 열 수 없습니다." />
              ) : view === 'team' && !team && resource.loading ? (
                <p role="status">팀을 불러오는 중…</p>
              ) : view === 'team' &&
                (!team || (!isApprovedMember(team) && !isManager)) ? (
                <UnavailablePage
                  title="팀을 열 수 없습니다."
                  description="팀이 없거나 조회 권한이 없습니다. 팀 목록에서 현재 소속을 확인해 주세요."
                />
              ) : menu === '스페이스 관리' && isManager ? (
                <SpaceSettings
                  key={space.id}
                  space={space}
                  onChanged={resource.reload}
                />
              ) : view === 'team' ? (
                <TeamWorkspace
                  key={team.id}
                  team={team}
                  space={space}
                  user={user}
                  menu={teamMenu}
                  taskId={taskId}
                  onChanged={resource.reload}
                  onRemoved={() => {
                    navigate(spacePath(spaceId), { replace: true });
                    resource.reload();
                  }}
                />
              ) : (
                <section className="stack">
                  <div className="page-heading">
                    <div>
                      <span className="role-badge">
                        {isManager ? '스페이스 관리자' : '스페이스 참여자'}
                      </span>
                      <h1>{space.name}</h1>
                      <p>{space.description}</p>
                    </div>
                    <button
                      className="primary-button"
                      disabled={!buildingOpen || Boolean(joinedTeam)}
                      onClick={() => {
                        setError(null);
                        setName('');
                        setCreating(true);
                      }}
                    >
                      <Icon name="plus" />팀 만들기
                    </button>
                  </div>
                  {joinedTeam && (
                    <p className="field-help">
                      현재 소속된 팀이 있습니다. 팀 목록의 ‘팀 열기’에서 작업을
                      이어가세요.
                    </p>
                  )}
                  <section className="panel building-panel">
                    <h2>
                      <Icon name="calendar" />
                      {buildingLabels[space.teamBuildingStatus]}
                    </h2>
                    <p>
                      프로젝트 · {formatDate(space.startAt)} ~{' '}
                      {formatDate(space.endAt)}
                    </p>
                    <p>
                      팀 빌딩 · {formatDate(space.teamBuildingOpensAt)} ~{' '}
                      {formatDate(space.teamBuildingClosesAt)}
                    </p>
                    {!buildingOpen && (
                      <p className="field-help">
                        현재 팀 생성과 가입 신청이 제한됩니다. 가입 대기는 팀
                        소속을 의미하지 않습니다.
                      </p>
                    )}
                  </section>
                  <ErrorNotice error={error} onRetry={resource.reload} />
                  {teams.length ? (
                    <ul className="team-list">
                      {teams.map((item) => (
                        <li
                          className={`team-card ${isApprovedMember(item) ? 'is-joined' : ''}`}
                          key={item.id}
                        >
                          <span className="team-symbol" aria-hidden="true">
                            <Icon name="users" />
                          </span>
                          <div className="team-card-main">
                            <h2>{item.name}</h2>
                            <p className="team-meta">
                              승인 팀원 {item.approvedMemberCount}명 ·{' '}
                              {{
                                APPROVED: '내 팀',
                                PENDING: '가입 승인 대기',
                                REJECTED: '가입 신청 반려',
                              }[item.myMembershipStatus] || '미가입'}
                            </p>
                            {!isManager &&
                              !isApprovedMember(item) &&
                              !item.canApply &&
                              item.myMembershipStatus !== 'PENDING' && (
                                <p className="field-help">
                                  {!buildingOpen
                                    ? '팀 빌딩 기간에만 가입을 신청할 수 있습니다.'
                                    : joinedTeam
                                      ? '이미 다른 팀에 소속되어 있습니다.'
                                      : '현재 팀 가입 신청 조건을 충족하지 않습니다.'}
                                </p>
                              )}
                          </div>
                          <div className="team-action">
                            {isApprovedMember(item) || isManager ? (
                              <button
                                className="secondary-button"
                                onClick={() =>
                                  navigate(
                                    teamMenuPath(
                                      spaceId,
                                      item.id,
                                      isApprovedMember(item)
                                        ? '팀 홈'
                                        : '팀원 관리',
                                    ),
                                  )
                                }
                              >
                                {isApprovedMember(item)
                                  ? '팀 열기'
                                  : '팀 자료 조회'}
                              </button>
                            ) : (
                              <button
                                className="primary-button"
                                disabled={
                                  busy || !buildingOpen || !item.canApply
                                }
                                onClick={() => apply(item)}
                              >
                                {item.myMembershipStatus === 'PENDING'
                                  ? '승인 대기'
                                  : item.myMembershipStatus === 'REJECTED'
                                    ? '다시 신청'
                                    : '가입 신청'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>
                      <p>아직 생성된 팀이 없습니다.</p>
                      <span>
                        {buildingOpen
                          ? '새 팀을 만들어 팀원을 모집하세요.'
                          : '팀 빌딩 기간이 열리면 팀을 만들 수 있습니다.'}
                      </span>
                    </EmptyState>
                  )}
                </section>
              )}
            </>
          )}
        </ResourceState>
        {creating && (
          <Modal
            title="팀 만들기"
            busy={busy}
            onClose={() => setCreating(false)}
            dirty={Boolean(name)}
          >
            <form onSubmit={submit}>
              <Field label="팀 이름">
                <input
                  required
                  maxLength={100}
                  disabled={busy}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <p className="field-help">
                생성자는 팀 리더가 됩니다. 작업은 승인된 팀원 2명 이상부터
                생성할 수 있습니다.
              </p>
              <ErrorNotice error={error} />
              <FormActions
                busy={busy}
                onCancel={() => setCreating(false)}
                label="팀 만들기"
              />
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}

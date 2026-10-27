import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { apiTimeToEpoch } from '../lib/koreanTime.js';
import { screenLoaders } from '../lib/routeScreens.js';
import { deferScreen } from './DeferredScreen.jsx';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { HeaderContext } from './HeaderContext.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import { getSpace } from '../api/spaces.js';
import {
  createTeam,
  cancelTeamJoin,
  getTeam,
  getTeamMembers,
  listTeams,
  requestTeamJoin,
} from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import SpaceHome from './SpaceHome.jsx';
import { formatDate, isApprovedMember } from '../lib/domain.js';

import UnavailablePage from './UnavailablePage.jsx';
import { spacePath, teamMenuPath } from '../lib/routes.js';

import WorkspaceNavigation from './WorkspaceNavigation.jsx';
import '../space-operation.css';
import {
  ErrorNotice,
  Field,
  FormActions,
  Modal,
  ResourceState,
} from './ui.jsx';

const SpaceSettings = deferScreen(screenLoaders.SpaceSettings, '스페이스 관리');
const SpaceParticipants = deferScreen(screenLoaders.SpaceParticipants, '참여자 관리');
const SpaceAnnouncements = deferScreen(screenLoaders.SpaceAnnouncements, '공지사항');
const TeamWorkspace = deferScreen(screenLoaders.TeamWorkspace, '팀 화면');
const ManagerDashboard = deferScreen(
  screenLoaders.ManagerDashboard,
  '팀 관리',
);
const RoundManagement = deferScreen(
  screenLoaders.RoundManagement,
  '동료 평가 관리',
);
const ReportReview = deferScreen(
  screenLoaders.ReportReview,
  '리포트 관리',
);
const MemberContributions = deferScreen(
  screenLoaders.MemberContributions,
  '팀원 수행 상세',
);

export default function SpaceWorkspace({
  spaceId,
  teamId,
  taskId,
  announcementId,
  meetingMinuteId,
  user,
  view,
  teamMenu,
  targetUserId,
  onBack,
}) {
  const guide = usePreviewGuide();
  const navigate = useAppNavigate();
  const location = useLocation();
  const setHeaderContext = useContext(HeaderContext);
  const { clearChanges, notify } = useInteractions();
  const resource = useResource(async () => {
    const [space, teams] = await Promise.all([
      getSpace(spaceId),
      listTeams(spaceId),
    ]);
    return { space, teams };
  }, [spaceId]);
  const dashboardTeamId = view === 'dashboard'
    ? new URLSearchParams(location.search).get('teamId')
    : null;
  const dashboardTeam = resource.data?.teams.find((entry) => String(entry.id) === dashboardTeamId);
  const directoryResource = useResource(
    () =>
      view === 'teams' && resource.data
        ? Promise.all(resource.data.teams.map((team) => getTeam(team.id)))
        : Promise.resolve([]),
    [spaceId, view === 'teams', resource.data],
  );
  const selectedTeamResource = useResource(async () => {
    if (teamId == null) return null;
    let detail;
    try {
      detail = await getTeam(teamId);
    } catch (error) {
      if (error.status === 404 && error.code === 'TEAM_NOT_FOUND') return null;
      throw error;
    }
    if (detail.spaceId !== spaceId)
      throw new Error(
        '이 스페이스에 속한 팀이 아닙니다. 팀 목록에서 다시 선택해 주세요.',
      );
    return detail;
  }, [spaceId, teamId]);
  const reloadWorkspace = useCallback(() => {
    resource.reload();
    selectedTeamResource.reload();
  }, [resource.reload, selectedTeamResource.reload]);
  const menu = view === 'settings' ? '스페이스 관리' : '팀 목록';
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setError(null);
  }, [resource.data]);
  const space = resource.data?.space;
  const teams = (resource.data?.teams || []).map((summary) =>
    selectedTeamResource.data?.id === summary.id
      ? selectedTeamResource.data
      : directoryResource.data?.find((detail) => detail.id === summary.id) ||
        summary,
  );
  const directoryReady =
    directoryResource.data != null &&
    !directoryResource.loading &&
    !directoryResource.error;
  const pageResource =
    teamId == null
      ? resource
      : {
          ...resource,
          data:
            resource.data &&
            (selectedTeamResource.data || !selectedTeamResource.loading)
              ? resource.data
              : null,
          loading: resource.loading || selectedTeamResource.loading,
          error: resource.error || selectedTeamResource.error,
          reload: reloadWorkspace,
        };
  const isManager = space?.myRole === 'MANAGER';
  const contributionMembers = useResource(
    () => view === 'contributions' && isManager && teamId != null
      ? getTeamMembers(teamId)
      : Promise.resolve(null),
    [view === 'contributions', isManager, teamId],
  );
  const contributionMemberName = contributionMembers.data?.find((member) => member.userId === targetUserId)?.name;
  const managerContext = {
    space,
    user,
    manager: true,
    teams,
  };
  const managerView = [
    'settings',
    'dashboard',
    'participants',
    'rounds',
    'reports',
    'contributions',
  ].includes(view);
  const team = selectedTeamResource.data;
  const managerTeamReadOnly = isManager && view === 'team' && team && !isApprovedMember(team);
  useEffect(() => {
    if (!setHeaderContext || !space) return;
    const titles = {
      settings: '스페이스 관리',
      dashboard: '팀 관리',
      participants: '참여자 관리',
      rounds: '동료 평가 관리',
      reports: '리포트 관리',
      contributions: '팀원 수행 상세',
      teams: '스페이스 홈',
      announcements: announcementId ? '공지 상세' : '공지사항',
    };
    setHeaderContext({
      pathname: location.pathname,
      spaceName: space.name,
      scope: managerView
        ? '관리 공간'
        : view === 'team'
          ? '팀 공간'
          : '스페이스',
      title:
        view === 'team'
          ? taskId
            ? '작업 상세'
            : managerTeamReadOnly && teamMenu === '팀원 관리' ? '팀원 보기' : teamMenu
          : titles[view] || '스페이스 홈',
      detail: [space.name, team?.name].filter(Boolean).join(' / '),
      manager: managerView,
      isTeamLeader:
        view === 'team' &&
        team?.id === teamId &&
        !selectedTeamResource.error &&
        isApprovedMember(team) &&
        team.leaderId === user.id,
    });
  }, [
    setHeaderContext,
    location.pathname,
    space,
    team,
    view,
    teamMenu,
    taskId,
    announcementId,
    managerView,
    managerTeamReadOnly,
    teamId,
    user.id,
    selectedTeamResource.error,
  ]);
  const joinedTeam = teams.find(isApprovedMember);
  const pendingTeam = teams.find((item) => item.myMembershipStatus === 'PENDING');
  const pendingCreationMessage = '팀 가입승인 대기 상태 이므로 팀을 만들 수 없습니다. 팀을 만드려면 신청 취소 해주세요';
  const teamRole = !team
    ? ''
    : team.leaderId === user.id
      ? '리더'
      : isApprovedMember(team)
          ? '팀원'
          : '관리자 조회';
  const buildingOpen =
    space?.teamBuildingStatus === 'OPEN' &&
    new Date(apiTimeToEpoch(space.teamBuildingOpensAt)) <= new Date() &&
    new Date(apiTimeToEpoch(space.teamBuildingClosesAt)) > new Date();
  const teamCreationRestriction = !directoryReady
    ? '팀 가입 상태를 확인한 뒤 팀을 만들 수 있습니다.'
    : joinedTeam
      ? `이미 ${joinedTeam.name} 팀에 소속되어 있습니다. 스페이스에서는 한 팀에만 소속될 수 있습니다.`
      : buildingOpen
        ? ''
        : {
            NOT_CONFIGURED:
              '관리자가 팀 빌딩 기간을 지정하면 팀을 만들 수 있습니다.',
            SCHEDULED: `팀 빌딩이 시작되는 ${formatDate(space?.teamBuildingOpensAt)}부터 팀을 만들 수 있습니다.`,
            CLOSED: '팀 빌딩 기간이 종료되어 팀을 만들 수 없습니다.',
            LOCKED: '평가가 시작되어 팀 구성이 고정되었습니다.',
          }[space?.teamBuildingStatus] ||
          '현재 팀을 만들 수 없습니다. 최신 팀 빌딩 상태를 확인해 주세요.';
  const apply = async (target) => {
    if (busy || !directoryReady || joinedTeam || pendingTeam || !buildingOpen || !target.canApply) return;
    setBusy(true);
    setError(null);
    try {
      await requestTeamJoin(target.id);
      notify(
        `${target.name} 팀에 가입을 신청했습니다. 리더의 승인을 기다려 주세요.`,
      );
      reloadWorkspace();
    } catch (requestError) {
      if (requestError.status === 409) {
        notify(requestError.message);
        reloadWorkspace();
      } else {
        setError(requestError);
      }
    } finally {
      setBusy(false);
    }
  };
  const cancelApplication = async (target) => {
    if (busy || !directoryReady || target.myMembershipStatus !== 'PENDING') return;
    setBusy(true);
    setError(null);
    try {
      await cancelTeamJoin(target.id);
      notify(`${target.name} 팀 가입 신청을 취소했습니다.`);
      reloadWorkspace();
    } catch (requestError) {
      if (requestError.status === 409 ||
          (requestError.status === 404 && requestError.code === 'APPLICATION_NOT_FOUND')) {
        notify(requestError.message);
        reloadWorkspace();
      } else {
        setError(requestError);
      }
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !directoryReady) return;
    if (pendingTeam) {
      setCreating(false);
      notify(pendingCreationMessage);
      return;
    }
    if (teamCreationRestriction) {
      setCreating(false);
      notify(teamCreationRestriction);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTeam(spaceId, name.trim());
      setCreating(false);
      clearChanges();
      notify('팀을 생성했습니다. 팀원을 모집해 작업을 시작하세요.');
      reloadWorkspace();
    } catch (requestError) {
      if (requestError.status === 409) {
        setCreating(false);
        notify(requestError.message);
        reloadWorkspace();
      } else {
        setError(requestError);
      }
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
      <main className="main-content" data-preview-guide-step={guide?.guiding ? guide.stepId : undefined}>
        {guide?.panel}
        <ResourceState resource={pageResource} label="스페이스 정보">
          {space && (
            <>
              {isManager && (
                <nav
                  className="mobile-manager-navigation"
                  aria-label="모바일 관리자 메뉴"
                >
                  {[
                    ['dashboard', '팀 관리'],
                    ['participants', '참여자'],
                    ['rounds', '평가'],
                    ['reports', '리포트'],
                    ['settings', '설정'],
                  ].map(([segment, label]) => (
                    <button
                      key={segment}
                      aria-label={segment === 'dashboard' ? '팀 관리' : undefined}
                      className={
                        view === segment ||
                        (segment === 'dashboard' && (view === 'contributions' || managerTeamReadOnly))
                          ? 'active'
                          : ''
                      }
                      aria-current={
                        view === segment ||
                        (segment === 'dashboard' && (view === 'contributions' || managerTeamReadOnly))
                          ? 'page'
                          : undefined
                      }
                      onClick={() =>
                        navigate(`${spacePath(spaceId)}/${segment}`)
                      }
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              )}
              {view !== 'teams' && !(view === 'team' && teamMenu === '팀 홈') && !(view === 'announcements' && announcementId != null) && <nav className="workspace-breadcrumb" aria-label="현재 위치">
                {(view === 'contributions' || dashboardTeamId || managerTeamReadOnly) && <>
                  <button onClick={() => {
                    const query = new URLSearchParams(view === 'dashboard' ? location.search : location.state?.dashboardSearch);
                    query.delete('teamId');
                    query.delete('tab');
                    navigate(`${spacePath(spaceId)}/dashboard${query.size ? `?${query}` : ''}`, {
                      state: { restoreScrollY: location.state?.dashboardListScrollY || 0 },
                    });
                  }}>팀 관리</button>
                  <span aria-hidden="true">/</span>
                </>}
                {team && (
                  <>
                    <button
                      onClick={() =>
                        navigate(
                          (view === 'contributions' || managerTeamReadOnly)
                            ? `${spacePath(spaceId)}/dashboard?${location.state?.dashboardSearch || `teamId=${team.id}`}`
                            : teamMenuPath(
                            spaceId,
                            team.id,
                            isApprovedMember(team) ? '팀 홈' : '팀원 관리',
                          ),
                          (view === 'contributions' || managerTeamReadOnly) ? { state: {
                            dashboardListScrollY: location.state?.dashboardListScrollY || 0,
                            restoreScrollY: location.state?.dashboardScrollY || 0,
                          } } : undefined,
                        )
                      }
                    >
                      {team.name}
                    </button>
                    <span aria-hidden="true">/</span>
                  </>
                )}
                <span aria-current="page">
                  {view === 'dashboard' && dashboardTeamId
                    ? dashboardTeam?.name || '팀 현황'
                    : view === 'team'
                    ? taskId
                      ? '작업 상세'
                      : managerTeamReadOnly && teamMenu === '팀원 관리' ? '팀원 보기' : teamMenu
                    : {
                        teams: '스페이스 홈',
                        announcements: announcementId ? '공지 상세' : '공지사항',
                        dashboard: '팀 관리',
                        participants: '참여자 관리',
                        rounds: '동료 평가 관리',
                        reports: '리포트 관리',
                        settings: '스페이스 관리',
                        contributions: contributionMemberName ? `${contributionMemberName}님의 수행 상세` : '팀원 수행 상세',
                      }[view]}
                </span>
                {team && teamRole !== '리더' && (
                  <span className="role-badge breadcrumb-role">{teamRole}</span>
                )}
              </nav>}
              {managerView && !isManager ? (
                <UnavailablePage
                  title="스페이스 관리 권한이 없습니다."
                  description="스페이스 관리자만 이 화면을 사용할 수 있습니다."
                />
              ) : view === 'announcements' ? (
                <SpaceAnnouncements key={`${space.id}:${announcementId || 'list'}`} space={space} announcementId={announcementId} />
              ) : view === 'participants' ? (
                <SpaceParticipants key={space.id} space={space} user={user} onChanged={reloadWorkspace} />
              ) : view === 'dashboard' ? (
                <ManagerDashboard context={managerContext} />
              ) : view === 'rounds' ? (
                <RoundManagement
                  context={managerContext}
                  onChanged={reloadWorkspace}
                />
              ) : view === 'reports' ? (
                <ReportReview context={managerContext} />
              ) : view === 'contributions' && team ? (
                <MemberContributions
                  key={`${team.id}:${targetUserId}`}
                  context={{
                    ...managerContext,
                    team,
                  }}
                  targetUserId={targetUserId}
                  members={contributionMembers}
                  onBack={() =>
                    navigate(
                      `${spacePath(spaceId)}/dashboard?${location.state?.dashboardSearch || `teamId=${team.id}`}`,
                      { state: { dashboardListScrollY: location.state?.dashboardListScrollY || 0, restoreScrollY: location.state?.dashboardScrollY || 0 } },
                    )
                  }
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
                  onChanged={reloadWorkspace}
                />
              ) : view === 'team' ? (
                <TeamWorkspace
                  key={team.id}
                  team={team}
                  space={space}
                  user={user}
                  menu={teamMenu}
                  taskId={taskId}
                  meetingMinuteId={meetingMinuteId}
                  onChanged={reloadWorkspace}
                  onRemoved={() => {
                    navigate(spacePath(spaceId), { replace: true });
                    reloadWorkspace();
                  }}
                />
              ) : (
                <SpaceHome
                  space={space}
                  teams={teams}
                  joinedTeam={joinedTeam}
                  user={user}
                  directoryReady={directoryReady}
                  buildingOpen={buildingOpen}
                  loading={resource.loading || directoryResource.loading}
                  busy={busy}
                  error={error}
                  directoryError={directoryResource.error}
                  teamCreationRestriction={teamCreationRestriction}
                  onReload={reloadWorkspace}
                  onCreate={() => {
                    if (busy || !directoryReady) return;
                    if (pendingTeam) {
                      notify(pendingCreationMessage);
                      return;
                    }
                    if (teamCreationRestriction) return;
                    setError(null);
                    setName('');
                    setCreating(true);
                  }}
                  onOpenTeam={(item) =>
                    navigate(
                      isManager
                        ? `${spacePath(spaceId)}/dashboard?teamId=${item.id}`
                        : teamMenuPath(
                        spaceId,
                        item.id,
                        isApprovedMember(item) ? '팀 홈' : '팀원 관리',
                      ),
                    )
                  }
                  onApply={apply}
                  onCancelApplication={cancelApplication}
                />
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

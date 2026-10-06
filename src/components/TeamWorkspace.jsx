import Icon from './Icon.jsx';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getTeamDeletionRequest, getTeamMembers } from '../api/teams.js';
import { listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { isApprovedMember, memberName } from '../lib/domain.js';
import Approvals from './Approvals.jsx';
import Deliverables from './Deliverables.jsx';
import TaskBoard from './TaskBoard.jsx';
import TeamMembers from './TeamMembers.jsx';
import TeamSettings from './TeamSettings.jsx';
import UnavailablePage from './UnavailablePage.jsx';
import { teamMenuPath } from '../lib/routes.js';
import { ErrorNotice, ResourceState } from './ui.jsx';

function TeamDeliverables({ team, user, members }) {
  const resource = useResource(
    () => (isApprovedMember(team) ? listTasks(team.id) : Promise.resolve([])),
    [team.id, team.myMembershipStatus],
  );
  return (
    <ResourceState resource={resource}>
      {resource.data && (
        <Deliverables
          team={team}
          user={user}
          members={members}
          tasks={resource.data}
          onChanged={resource.reload}
        />
      )}
    </ResourceState>
  );
}

export default function TeamWorkspace({
  team,
  space,
  user,
  menu,
  taskId,
  onChanged,
  onBack,
  onRemoved,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateToMenu = (nextMenu) =>
    navigate(teamMenuPath(space.id, team.id, nextMenu));
  const navigateToTask = (id) =>
    navigate({
      pathname: `${teamMenuPath(space.id, team.id, menu)}/${menu === '승인 검토' ? 'tasks/' : ''}${id}`,
      search: location.search,
    });
  const navigateToTaskList = () =>
    navigate({
      pathname: teamMenuPath(space.id, team.id, menu),
      search: location.search,
    });
  const resource = useResource(
    () => getTeamMembers(team.id),
    [team.id, team.deputyId, team.approvedMemberCount],
  );
  const approved = isApprovedMember(team);
  const deletionResource = useResource(async () => {
    if (!approved) return null;
    try {
      return await getTeamDeletionRequest(team.id);
    } catch (error) {
      if (
        error.status === 404 &&
        error.code === 'TEAM_DELETION_REQUEST_NOT_FOUND'
      )
        return null;
      throw error;
    }
  }, [team.id, approved, menu, taskId]);
  useEffect(() => {
    const refresh = () => {
      deletionResource.reload();
      resource.reload();
      onChanged();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [deletionResource.reload, resource.reload, onChanged]);
  const workTeam = {
    ...team,
    workFrozen: approved && Boolean(deletionResource.data?.workFrozen),
    workStateUnknown:
      approved && (deletionResource.loading || Boolean(deletionResource.error)),
  };
  const menus = approved
    ? ['팀 홈', '작업 보드', '산출물', '승인 검토', '팀원 관리', '팀 설정']
    : ['팀원 관리', '산출물'];
  const currentMenu = menus.includes(menu) ? menu : null;
  const members = resource.data || [];
  const myRole =
    team.leaderId === user.id
      ? '리더'
      : team.deputyId === user.id
        ? '부리더'
        : approved
          ? '팀원'
          : '관리자 조회';
  return (
    <section className="stack">
      <div className="section-heading team-context">
        <button className="secondary-button" onClick={onBack}>
          <Icon name="back" />팀 목록
        </button>
        <span className="team-context-name">
          {team.name}
          <span className="role-badge">{myRole}</span>
        </span>
      </div>
      <nav className="tab-bar" aria-label="팀 메뉴">
        {menus.map((item) => (
          <button
            key={item}
            className={currentMenu === item ? 'active' : ''}
            aria-current={currentMenu === item ? 'page' : undefined}
            onClick={() => navigateToMenu(item)}
          >
            <Icon
              name={
                {
                  '팀 홈': 'home',
                  '작업 보드': 'board',
                  산출물: 'file',
                  '승인 검토': 'check',
                  '팀원 관리': 'users',
                  '팀 설정': 'settings',
                }[item]
              }
            />
            {item}
          </button>
        ))}
      </nav>
      {approved && currentMenu !== '팀 설정' && (
        <>
          <ErrorNotice
            error={deletionResource.error}
            onRetry={deletionResource.reload}
          />
          {(workTeam.workFrozen || workTeam.workStateUnknown) && (
            <div className="notice lifecycle-notice">
              <span>
                {workTeam.workStateUnknown
                  ? '삭제 동의 현황을 확인할 때까지 작업 변경이 제한됩니다.'
                  : '팀 삭제 동의가 진행 중입니다. 작업과 산출물은 조회만 할 수 있습니다.'}
              </span>
              <button
                className="secondary-button"
                onClick={() => navigateToMenu('팀 설정')}
              >
                삭제 동의 확인
              </button>
            </div>
          )}
          {team.approvedMemberCount < 2 && (
            <p className="notice">
              승인된 팀원이 2명 이상이어야 작업 생성·수정·수행 설명·완료 요청을
              진행할 수 있습니다. 자료 조회와 정리는 가능합니다.
            </p>
          )}
        </>
      )}
      <ResourceState resource={resource}>
        {!menus.includes(menu) && (
          <UnavailablePage
            title="이 팀 화면에 접근할 수 없습니다."
            description="승인된 팀원만 작업과 팀 설정을 사용할 수 있습니다. 조회 가능한 팀 메뉴를 선택해 주세요."
          />
        )}
        {currentMenu === '팀 홈' && (
          <section className="stack">
            <div>
              <span className="eyebrow">우리 팀의 작업 공간</span>
              <h1>{team.name}</h1>
              <p>
                승인된 팀원 {team.approvedMemberCount}명 · 리더{' '}
                {memberName(members, team.leaderId)}
                {team.deputyId &&
                  ` · 부리더 ${memberName(members, team.deputyId)}`}
              </p>
            </div>
            <section className="next-action-card">
              <div>
                <span className="eyebrow">다음 단계</span>
                <h2>
                  {team.canCreateTask
                    ? '함께 작업을 시작하세요'
                    : '팀원을 먼저 모아 주세요'}
                </h2>
                <p>
                  {team.canCreateTask
                    ? '담당 작업을 확인하고, 산출물과 수행 내용을 기록하세요.'
                    : '승인된 팀원이 2명 이상이어야 작업을 생성할 수 있습니다.'}
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() =>
                  navigateToMenu(team.canCreateTask ? '작업 보드' : '팀원 관리')
                }
              >
                {team.canCreateTask ? '작업 보드 열기' : '팀원 관리'}
              </button>
            </section>
            <div className="quick-links">
              {[
                {
                  label: '작업 보드',
                  icon: 'board',
                  description: '담당 작업의 진행 상태와 마감일을 확인하세요.',
                },
                {
                  label: '산출물',
                  icon: 'file',
                  description: '프로젝트 자료와 작업 결과를 한곳에 모으세요.',
                },
                {
                  label: '승인 검토',
                  icon: 'check',
                  description: '내게 요청된 완료 검토를 확인하세요.',
                },
              ].map(({ label, icon, description }) => (
                <button
                  className="quick-link"
                  key={label}
                  onClick={() => navigateToMenu(label)}
                >
                  <span className="space-symbol">
                    <Icon name={icon} />
                  </span>
                  <strong>{label}</strong>
                  <span>{description}</span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </section>
        )}
        {currentMenu === '팀원 관리' && (
          <TeamMembers
            team={team}
            user={user}
            onChanged={() => {
              resource.reload();
              onChanged();
            }}
          />
        )}
        {currentMenu === '작업 보드' && approved && (
          <TaskBoard
            team={workTeam}
            user={user}
            members={members}
            taskId={taskId}
            onOpenTask={navigateToTask}
            onTaskBack={navigateToTaskList}
          />
        )}
        {currentMenu === '산출물' && (
          <TeamDeliverables team={workTeam} user={user} members={members} />
        )}
        {currentMenu === '승인 검토' && approved && (
          <Approvals
            team={workTeam}
            user={user}
            members={members}
            taskId={taskId}
            onOpenTask={navigateToTask}
            onTaskBack={navigateToTaskList}
          />
        )}
        {currentMenu === '팀 설정' && approved && (
          <TeamSettings
            team={team}
            space={space}
            user={user}
            members={members}
            deletionResource={deletionResource}
            onNavigate={navigateToMenu}
            onRemoved={onRemoved}
            onChanged={() => {
              deletionResource.reload();
              onChanged();
            }}
          />
        )}
      </ResourceState>
    </section>
  );
}

import { useState } from 'react';
import { getTeamMembers } from '../api/teams.js';
import { listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { isApprovedMember, memberName } from '../lib/domain.js';
import Approvals from './Approvals.jsx';
import Deliverables from './Deliverables.jsx';
import TaskBoard from './TaskBoard.jsx';
import TeamMembers from './TeamMembers.jsx';
import { ResourceState } from './ui.jsx';

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

export default function TeamWorkspace({ team, user, onChanged, onBack }) {
  const resource = useResource(
    () => getTeamMembers(team.id),
    [team.id, team.deputyId, team.approvedMemberCount],
  );
  const [menu, setMenu] = useState('팀 홈');
  const approved = isApprovedMember(team);
  const menus = approved
    ? ['팀 홈', '작업 보드', '산출물', '승인 검토', '팀원 관리']
    : ['팀원 관리', '산출물'];
  const currentMenu = menus.includes(menu) ? menu : menus[0];
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
      <div className="section-heading">
        <button className="secondary-button" onClick={onBack}>
          ← 팀 목록
        </button>
        <span>
          {team.name} · {myRole}
        </span>
      </div>
      <nav className="tab-bar" aria-label="팀 메뉴">
        {menus.map((item) => (
          <button
            key={item}
            className={currentMenu === item ? 'active' : ''}
            onClick={() => setMenu(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <ResourceState resource={resource}>
        {currentMenu === '팀 홈' && (
          <section className="stack">
            <div>
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
                  setMenu(team.canCreateTask ? '작업 보드' : '팀원 관리')
                }
              >
                {team.canCreateTask ? '작업 보드 열기' : '팀원 관리'}
              </button>
            </section>
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
        {currentMenu === '작업 보드' && (
          <TaskBoard team={team} user={user} members={members} />
        )}
        {currentMenu === '산출물' && (
          <TeamDeliverables team={team} user={user} members={members} />
        )}
        {currentMenu === '승인 검토' && (
          <Approvals team={team} user={user} members={members} />
        )}
      </ResourceState>
    </section>
  );
}

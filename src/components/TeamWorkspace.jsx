import Icon from './Icon.jsx';
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
            onClick={() => setMenu(item)}
          >
            <Icon
              name={
                {
                  '팀 홈': 'home',
                  '작업 보드': 'board',
                  산출물: 'file',
                  '승인 검토': 'check',
                  '팀원 관리': 'users',
                }[item]
              }
            />
            {item}
          </button>
        ))}
      </nav>
      <ResourceState resource={resource}>
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
                  setMenu(team.canCreateTask ? '작업 보드' : '팀원 관리')
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
                  onClick={() => setMenu(label)}
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

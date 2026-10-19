import { getTeam, listTeams } from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import { isApprovedMember } from '../lib/domain.js';

function ParticipantRole({ space, user }) {
  // A refreshed directory entry must also refresh its current team membership.
  const teams = useResource(
    async () => {
      const summaries = await listTeams(space.id);
      // List responses can omit membership; resolve it from the team detail API.
      return Promise.all(
        summaries.map((team) =>
          Object.hasOwn(team, 'myMembershipStatus') &&
          (team.myMembershipStatus !== 'APPROVED' ||
            Object.hasOwn(team, 'leaderId'))
            ? team
            : getTeam(team.id),
        ),
      );
    },
    [space.id, user.id, space],
  );
  const leader = (teams.data || []).some(
    (team) => isApprovedMember(team) && team.leaderId === user.id,
  );
  const member = (teams.data || []).some(isApprovedMember);
  const pending = teams.loading || Boolean(teams.error);
  return (
    <span
      className={`role-badge${pending ? ' role-unconfirmed' : ''}`}
      aria-busy={teams.loading}
      title={
        teams.error
          ? '팀 역할을 확인하지 못했습니다. 상단 새로고침으로 다시 확인해 주세요.'
          : undefined
      }
    >
      {teams.loading
        ? '역할 확인 중'
        : teams.error
          ? '역할 확인 필요'
          : leader
            ? '팀 리더'
            : member
              ? '팀원'
              : '참여자'}
    </span>
  );
}

export default function SpaceRoleBadge({ space, user }) {
  if (space.myRole === 'MANAGER')
    return <span className="role-badge role-manager">관리자</span>;
  return <ParticipantRole space={space} user={user} />;
}

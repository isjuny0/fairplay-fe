import { useEffect, useId, useRef, useState } from 'react';
import { getTeamMembers } from '../api/teams.js';
import useResource from '../hooks/useResource.js';
import Icon from './Icon.jsx';

export default function TeamMemberCount({ team }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const tooltipId = useId();
  const members = useResource(
    () => open ? getTeamMembers(team.id) : Promise.resolve(null),
    [team.id, team.approvedMemberCount, open],
  );
  useEffect(() => {
    if (!open || members.loading || !window.matchMedia('(max-width: 720px)').matches)
      return;
    if (root.current?.contains(document.activeElement))
      root.current.querySelector('[role="tooltip"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [open, members.loading, members.data, members.error]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const count = team.approvedMemberCount;
  return (
    <span
      className="space-home-members"
      ref={root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="space-home-member-count"
        aria-label={`${team.name} 팀원${count == null ? '' : ` ${count}명`} 보기`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <Icon name="users" />
        {count == null ? '팀원 확인 중' : `팀원 ${count}명`}
      </button>
      {open && (
        <span className="space-home-member-tooltip" id={tooltipId} role="tooltip">
          {members.loading ? (
            <span className="space-home-member-notice">팀원을 불러오는 중…</span>
          ) : members.error ? (
            <span className="space-home-member-notice">
              {members.error.status === 403
                ? '팀원 목록을 볼 권한이 없습니다.'
                : '팀원 목록을 불러오지 못했습니다.'}
            </span>
          ) : members.data?.length ? (
            <span className="space-home-member-names" role="list" aria-label={`${team.name} 팀원 명단`}>
              {members.data.map((member) => (
                <span className="space-home-member-row" role="listitem" key={member.userId}>
                  <span className="space-home-member-name">{member.name || '이름 없음'}</span>
                  {(member.role === 'LEADER' || member.userId === team.leaderId) && (
                    <span className="space-home-member-leader" role="img" aria-label="팀 리더" />
                  )}
                </span>
              ))}
            </span>
          ) : (
            <span className="space-home-member-notice">등록된 팀원이 없습니다.</span>
          )}
        </span>
      )}
    </span>
  );
}

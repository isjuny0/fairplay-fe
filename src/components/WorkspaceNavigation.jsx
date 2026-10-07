import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { listSpaces } from '../api/spaces.js';
import useAppNavigate from '../hooks/useAppNavigate.js';
import useResource from '../hooks/useResource.js';
import { isApprovedMember } from '../lib/domain.js';
import { spacePath, teamMenuPath } from '../lib/routes.js';
import {
  availableTeamMenus,
  teamNavigationGroups,
} from '../lib/teamNavigation.js';
import Icon from './Icon.jsx';
import { ErrorNotice } from './ui.jsx';

export default function WorkspaceNavigation({
  space,
  spaceId,
  teams,
  team,
  view,
  teamMenu,
  teamRole,
  user,
  onBack,
}) {
  const navigate = useAppNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const spaces = useResource(listSpaces, [user.id]);
  const isManager = space?.myRole === 'MANAGER';
  const accessibleTeams = teams.filter(
    (item) => isManager || isApprovedMember(item),
  );
  const selectedTeam = team || teams.find(isApprovedMember);
  const menus = team ? availableTeamMenus(team) : [];
  const navButton = (label, icon, destination, active) => (
    <button
      key={label}
      className={`nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        setOpen(false);
        navigate(destination);
      }}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
  return (
    <aside
      className={`sidebar workspace-sidebar ${open ? 'is-mobile-open' : ''}`}
    >
      <button
        className="mobile-space-toggle"
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(!open)}
      >
        <span className="mobile-workspace-context">
          <strong>{space?.name || '스페이스'}</strong>
          {team && (
            <span>
              {team.name} · {teamRole}
            </span>
          )}
        </span>
        <span>공간·팀 선택 {open ? '⌃' : '⌄'}</span>
      </button>
      <nav id="workspace-navigation" aria-label="스페이스 메뉴">
        <button
          className="nav-item"
          onClick={() => {
            setOpen(false);
            onBack();
          }}
        >
          <Icon name="back" />내 스페이스
        </button>
        <div className="workspace-selectors">
          <label>
            <span>스페이스 선택</span>
            <select
              aria-label="스페이스 선택"
              value={spaceId}
              disabled={spaces.loading && !spaces.data}
              onChange={(event) => {
                setOpen(false);
                navigate(spacePath(Number(event.target.value)));
              }}
            >
              {!(spaces.data || []).some(
                (item) => (item.spaceId ?? item.id) === spaceId,
              ) && (
                <option value={spaceId}>
                  {space?.name || '현재 스페이스'}
                </option>
              )}
              {(spaces.data || []).map((item) => (
                <option
                  key={item.spaceId ?? item.id}
                  value={item.spaceId ?? item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <ErrorNotice error={spaces.error} onRetry={spaces.reload} />
          <label>
            <span>팀 선택</span>
            <select
              aria-label="팀 선택"
              value={
                team && ['team', 'contributions'].includes(view) ? team.id : ''
              }
              disabled={!accessibleTeams.length}
              onChange={(event) => {
                setOpen(false);
                const nextTeam = accessibleTeams.find(
                  (item) => item.id === Number(event.target.value),
                );
                navigate(
                  nextTeam
                    ? teamMenuPath(
                        spaceId,
                        nextTeam.id,
                        isApprovedMember(nextTeam) ? '팀 홈' : '팀원 관리',
                      )
                    : spacePath(spaceId),
                );
              }}
            >
              <option value="">
                {accessibleTeams.length ? '팀 목록 보기' : '소속된 팀 없음'}
              </option>
              {accessibleTeams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {navButton('팀 목록', 'users', spacePath(spaceId), view === 'teams')}
        {isManager && (
          <div className="workspace-nav-group">
            <p className="nav-section">스페이스 운영</p>
            {[
              ['dashboard', '관리자 대시보드', 'grid'],
              ['rounds', '평가 회차 관리', 'calendar'],
              ['reports', '리포트 검토·공개', 'file'],
              ['settings', '스페이스 관리', 'settings'],
            ].map(([segment, label, icon]) =>
              navButton(
                label,
                icon,
                `${spacePath(spaceId)}/${segment}`,
                view === segment ||
                  (segment === 'dashboard' && view === 'contributions'),
              ),
            )}
          </div>
        )}
        {!team &&
          selectedTeam &&
          !isManager &&
          navButton(
            `내 팀 · ${selectedTeam.name}`,
            'home',
            teamMenuPath(spaceId, selectedTeam.id, '팀 홈'),
            false,
          )}
        {team && (isManager || isApprovedMember(team)) && (
          <nav className="desktop-team-navigation" aria-label="팀 메뉴">
            {!isApprovedMember(team) ? (
              <div className="workspace-nav-group">
                <p className="nav-section">팀 자료 조회</p>
                {menus.map((label) =>
                  navButton(
                    label,
                    label === '산출물' ? 'file' : 'users',
                    teamMenuPath(spaceId, team.id, label),
                    view === 'team' && teamMenu === label,
                  ),
                )}
              </div>
            ) : (
              teamNavigationGroups.map((group, index) => {
                const items = group.items.filter(([label]) =>
                  menus.includes(label),
                );
                return (
                  items.length > 0 && (
                    <div
                      className="workspace-nav-group"
                      key={group.label || index}
                    >
                      {group.label && (
                        <p className="nav-section">{group.label}</p>
                      )}
                      {items.map(([label, icon]) =>
                        navButton(
                          label,
                          icon,
                          teamMenuPath(spaceId, team.id, label),
                          view === 'team' && teamMenu === label,
                        ),
                      )}
                    </div>
                  )
                );
              })
            )}
          </nav>
        )}
      </nav>
    </aside>
  );
}

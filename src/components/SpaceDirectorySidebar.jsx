import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Icon from './Icon.jsx';

const sidebarPreferenceKey = 'fairplay:workspace-sidebar-collapsed';

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === 'true';
  } catch {
    return false;
  }
}

const views = [
  { role: 'ALL', label: '내 스페이스', icon: 'grid' },
  { role: 'MANAGER', label: '관리 중', icon: 'settings' },
  { role: 'USER', label: '참여 중', icon: 'users' },
];

export default function SpaceDirectorySidebar({
  spaces,
  loading,
  unavailable,
  role,
  onRoleChange,
  onCreate,
  onJoin,
  onSelect,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readSidebarPreference);
  const [desktopLayout, setDesktopLayout] = useState(
    () => window.matchMedia('(min-width: 721px)').matches,
  );
  const menuId = useId();
  const hasData = !unavailable && (!loading || spaces.length > 0);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 721px)');
    const updateLayout = () => setDesktopLayout(query.matches);
    updateLayout();
    query.addEventListener('change', updateLayout);
    return () => query.removeEventListener('change', updateLayout);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(collapsed));
    } catch {
      // Keep the control usable when browser storage is unavailable.
    }
  }, [collapsed]);
  const sidebarCollapsed = desktopLayout && collapsed;
  return (
    <>
      <aside
        className={`space-directory-sidebar ${menuOpen ? 'is-open' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
        aria-label="스페이스 사이드바"
        aria-hidden={sidebarCollapsed || undefined}
        inert={sidebarCollapsed ? '' : undefined}
      >
        <div className="directory-sidebar-heading">
          <div>
            <span>WORKSPACE</span>
            <strong>함께 만드는 공간</strong>
          </div>
          <button
            className="directory-sidebar-toggle"
            aria-label="스페이스 메뉴"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <ChevronDown size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="directory-sidebar-content" id={menuId}>
          <nav className="directory-sidebar-views" aria-label="스페이스 보기">
            {views.map((view) => (
              <button
                key={view.role}
                className={`directory-sidebar-link ${role === view.role ? 'active' : ''}`}
                aria-pressed={role === view.role}
                onClick={() => onRoleChange(view.role)}
              >
                <Icon name={view.icon} />
                <span>{view.label}</span>
                {hasData && (
                  <small aria-hidden="true">
                    {view.role === 'ALL'
                      ? spaces.length
                      : spaces.filter((space) => space.myRole === view.role)
                          .length}
                  </small>
                )}
              </button>
            ))}
          </nav>
          <div
            className="directory-sidebar-actions"
            role="group"
            aria-label="스페이스 빠른 실행"
          >
            <span className="directory-sidebar-label">빠른 실행</span>
            <button className="directory-sidebar-link" onClick={onCreate}>
              <Icon name="plus" />
              <span>새 스페이스</span>
            </button>
            <button className="directory-sidebar-link" onClick={onJoin}>
              <Icon name="users" />
              <span>스페이스 참여</span>
            </button>
          </div>
          <nav
            className="directory-sidebar-shortcuts"
            aria-label="스페이스 바로가기"
          >
            <span className="directory-sidebar-label">내 공간 바로가기</span>
            {hasData && spaces.length > 0 ? (
              spaces.slice(0, 6).map((space) => (
                <button
                  key={space.id}
                  className="directory-sidebar-link directory-space-shortcut"
                  aria-label={`스페이스 바로가기: ${space.name}`}
                  onClick={() => onSelect(space.id)}
                >
                  <span className="directory-shortcut-symbol" aria-hidden="true">
                    {space.name.slice(0, 1)}
                  </span>
                  <span className="directory-shortcut-name">{space.name}</span>
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="directory-sidebar-empty">
                {unavailable
                  ? '목록을 불러오지 못했습니다.'
                  : loading
                    ? '공간을 불러오는 중…'
                    : '참여한 스페이스가 여기에 표시됩니다.'}
              </p>
            )}
            {hasData && spaces.length > 6 && (
              <p className="directory-sidebar-empty">
                전체 공간은 오른쪽 목록에서 확인하세요.
              </p>
            )}
          </nav>
          <p className="directory-sidebar-note">
            하나의 공간에서
            <br />
            우리 팀의 프로젝트를 함께.
          </p>
        </div>
      </aside>
      <div
        className={`space-directory-sidebar-rail ${sidebarCollapsed ? 'is-collapsed' : ''}`}
      >
        <button
          className="space-directory-sidebar-toggle"
          type="button"
          aria-controls={menuId}
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span
            className={`sidebar-toggle-glyph ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </>
  );
}

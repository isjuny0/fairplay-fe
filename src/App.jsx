import { useEffect, useMemo, useState } from 'react';
import { createSpace, joinSpace, listSpaces } from './api/spaces.js';
import { createTeam, listTeams, requestTeamJoin } from './api/teams.js';
import InstructorDashboard from './components/InstructorDashboard.jsx';

const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const commonMenus = ['팀 목록', '팀 홈', '작업', '승인 대기', 'AI 작업 평가', '동료 평가', '기여도 리포트'];
const instructorMenus = ['스페이스 대시보드', '리포트 검토 및 공개'];

const roleLabels = {
  INSTRUCTOR: '교수',
  MANAGER: '교수',
  manager: '교수',
  TEAM_LEADER: '팀장',
  DEPUTY_LEADER: '부리더',
  STUDENT: '팀원',
  USER: '팀원',
  user: '팀원',
};

const isInstructorRole = (role) => ['INSTRUCTOR', 'MANAGER', 'manager'].includes(role);

const membershipLabels = {
  PENDING: '신청 대기',
  JOINED: '가입 완료',
  APPROVED: '가입 완료',
  REJECTED: '신청 거절',
};

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="google-icon"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z"/><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"/></svg>;
}

function Modal({ title, submitLabel, onClose, onSubmit, children, isSubmitting, error }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>×</button></div><form onSubmit={onSubmit}>{children}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? '처리 중...' : submitLabel}</button></div></form></section></div>;
}

function TeamStatus({ status, isFull }) {
  if (membershipLabels[status]) {
    return <span className={`status-badge status-${status.toLowerCase()}`}>{membershipLabels[status]}</span>;
  }
  if (isFull) return <span className="status-badge status-full">모집 마감</span>;
  return <span className="status-badge status-open">참가 가능</span>;
}

function App() {
  const [screen, setScreen] = useState(window.location.pathname === '/main' ? 'main' : 'login');
  const [spaces, setSpaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [activeMenu, setActiveMenu] = useState('스페이스');
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamCapacity, setTeamCapacity] = useState(6);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamFormError, setTeamFormError] = useState('');
  const [joiningTeamId, setJoiningTeamId] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const joinedTeam = useMemo(
    () => teams.find((team) => ['JOINED', 'APPROVED'].includes(team.membershipStatus)),
    [teams],
  );

  useEffect(() => {
    const onPopState = () => setScreen(window.location.pathname === '/main' ? 'main' : 'login');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (screen !== 'main') return;
    setIsLoading(true);
    listSpaces().then(setSpaces).finally(() => setIsLoading(false));
  }, [screen]);

  useEffect(() => {
    if (!selectedSpace || isInstructorRole(selectedSpace.role)) {
      setTeams([]);
      setTeamsError('');
      return undefined;
    }

    let cancelled = false;
    setTeamsLoading(true);
    setTeamsError('');
    listTeams(selectedSpace.id)
      .then((nextTeams) => {
        if (!cancelled) setTeams(nextTeams);
      })
      .catch((requestError) => {
        if (!cancelled) setTeamsError(requestError.message || '팀 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpace]);

  const handleGoogleLogin = () => {
    if (import.meta.env.VITE_AUTH_MODE !== 'oauth') {
      window.history.pushState({}, '', '/main');
      setScreen('main');
      return;
    }
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
    window.location.assign(`${apiBaseUrl}/oauth2/authorization/google`);
  };

  const handleLogout = () => {
    window.history.pushState({}, '', '/');
    setScreen('login');
    setSidebarOpen(false);
    setSelectedSpace(null);
    setSelectedTeam(null);
    setActiveMenu('스페이스');
  };

  const selectMenu = (menu) => {
    setActiveMenu(menu);
    setSidebarOpen(false);
  };

  const handleSpaceSelect = (space) => {
    setSelectedSpace(space);
    setSelectedTeam(null);
    setActiveMenu(isInstructorRole(space.role) ? '스페이스 대시보드' : '팀 목록');
  };

  const openModal = (type) => {
    setInput('');
    setError('');
    if (type === 'team') {
      setTeamName('');
      setTeamCapacity(6);
      setTeamFormError('');
    }
    setModal(type);
  };

  const handleSpaceSubmit = async (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError(modal === 'create' ? '스페이스 이름을 입력해 주세요.' : '참여 코드를 입력해 주세요.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const nextSpace = modal === 'create' ? await createSpace(value) : await joinSpace(value);
      setSpaces((current) => [...current, nextSpace]);
      handleSpaceSelect(nextSpace);
      setModal(null);
    } catch (requestError) {
      setError(requestError.message || '요청을 처리하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeamSubmit = async (event) => {
    event.preventDefault();
    const name = teamName.trim();
    const maxMembers = Number(teamCapacity);
    if (!name) {
      setTeamFormError('팀 이름을 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 20) {
      setTeamFormError('팀 정원은 2명에서 20명 사이로 입력해 주세요.');
      return;
    }

    setTeamFormError('');
    setTeamSubmitting(true);
    try {
      const nextTeam = await createTeam(selectedSpace.id, { name, maxMembers });
      setTeams((current) => [...current, nextTeam]);
      setSelectedTeam(nextTeam);
      setModal(null);
    } catch (requestError) {
      setTeamFormError(requestError.message || '팀을 생성하지 못했습니다.');
    } finally {
      setTeamSubmitting(false);
    }
  };

  const handleJoinRequest = async (teamId) => {
    setTeamsError('');
    setJoiningTeamId(teamId);
    try {
      const updatedTeam = await requestTeamJoin(selectedSpace.id, teamId);
      setTeams((current) => current.map((team) => (team.id === teamId ? updatedTeam : team)));
    } catch (requestError) {
      setTeamsError(requestError.message || '참가 신청을 처리하지 못했습니다.');
    } finally {
      setJoiningTeamId(null);
    }
  };

  const reloadTeams = () => {
    if (!selectedSpace) return;
    setTeamsLoading(true);
    setTeamsError('');
    listTeams(selectedSpace.id)
      .then(setTeams)
      .catch((requestError) => setTeamsError(requestError.message || '팀 목록을 불러오지 못했습니다.'))
      .finally(() => setTeamsLoading(false));
  };

  if (screen === 'login') {
    return <main className="login-page"><section className="login-card" aria-label="로그인"><p className="login-description">Google 계정으로 로그인해 주세요.</p><button type="button" className="google-button" onClick={handleGoogleLogin}><GoogleIcon/><span>Google로 계속하기</span></button><p className="terms">계속하면 Fairplay의 이용약관과 개인정보 처리방침에 동의하게 됩니다.</p></section></main>;
  }

  const userRole = selectedSpace?.role || 'STUDENT';
  const isInstructor = isInstructorRole(userRole);
  const menus = isInstructor ? instructorMenus : commonMenus;
  const currentTeam = selectedTeam || joinedTeam;

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-brand"><button type="button" className="menu-button" aria-label="메뉴 열기" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button><span className="logo-mark" aria-hidden="true">F</span><span className="wordmark">Fairplay</span></div>
      <div className="context-info"><strong>{selectedSpace?.name || '스페이스 미선택'}</strong><span>{currentTeam?.name || '팀 미선택'}</span><span>다음 마감 없음</span></div>
      <div className="profile-area"><span className="role-badge">{roleLabels[userRole]}</span><span className="profile-name">사용자</span><button type="button" className="logout-button" onClick={handleLogout}>로그아웃</button></div>
    </header>
    <div className="workspace">
      {sidebarOpen && <button type="button" className="sidebar-overlay" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)}/>}
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label="주요 메뉴"><nav><button type="button" className={activeMenu === '스페이스' ? 'nav-item active' : 'nav-item'} aria-current={activeMenu === '스페이스' ? 'page' : undefined} onClick={() => selectMenu('스페이스')}>스페이스</button>{selectedSpace && <><p className="nav-section">{selectedSpace.name}</p>{menus.map((menu) => <button key={menu} type="button" className={activeMenu === menu ? 'nav-item active' : 'nav-item'} aria-current={activeMenu === menu ? 'page' : undefined} onClick={() => selectMenu(menu)}>{menu}</button>)}</>}</nav></aside>
      <main className="main-content">
        {activeMenu === '스페이스' && <><div className="page-heading"><div><h1>내 스페이스</h1><p>참여 중인 스페이스를 확인하거나 새로 시작하세요.</p></div><div className="heading-actions"><button type="button" className="secondary-button" onClick={() => openModal('join')}>코드로 참가</button><button type="button" className="primary-button" onClick={() => openModal('create')}>스페이스 생성</button></div></div>{isLoading ? <p className="status-message">목록을 불러오는 중...</p> : spaces.length === 0 ? <section className="empty-state"><p>참여 중인 스페이스가 없습니다.</p><span>스페이스를 생성하거나 전달받은 참여 코드를 입력해 주세요.</span></section> : <ul className="space-list">{spaces.map((space) => <li key={space.id}><button type="button" aria-pressed={selectedSpace?.id === space.id} onClick={() => handleSpaceSelect(space)}><strong>{space.name}</strong><span>{roleLabels[space.role] || '팀원'}</span></button></li>)}</ul>}</>}

        {activeMenu === '팀 목록' && !isInstructor && <><div className="page-heading"><div><h1>팀 목록</h1><p>참여할 팀을 확인하거나 새 팀을 만드세요.</p></div><div className="heading-actions"><button type="button" className="primary-button" onClick={() => openModal('team')} disabled={Boolean(joinedTeam)}>새 팀 만들기</button></div></div>{teamsError && <div className="inline-error" role="alert"><span>{teamsError}</span><button type="button" onClick={reloadTeams}>다시 시도</button></div>}{teamsLoading ? <p className="status-message">팀 목록을 불러오는 중...</p> : teams.length === 0 ? <section className="empty-state"><p>아직 만들어진 팀이 없습니다.</p><span>새 팀을 만들면 생성자가 팀장이 됩니다.</span></section> : <ul className="team-list">{teams.map((team) => {
          const isFull = team.memberCount >= team.maxMembers;
          const isJoined = ['JOINED', 'APPROVED'].includes(team.membershipStatus);
          const isPending = team.membershipStatus === 'PENDING';
          const cannotJoinOtherTeam = Boolean(joinedTeam && !isJoined);
          return <li key={team.id} className={isJoined ? 'team-card is-joined' : 'team-card'}><div className="team-card-main"><div className="team-card-header"><h2>{team.name}</h2><TeamStatus status={team.membershipStatus} isFull={isFull}/></div><div className="team-meta"><span>인원 <strong>{team.memberCount}/{team.maxMembers}명</strong></span><span>리더 <strong>{team.leaderName}</strong></span></div></div><div className="team-action">{isJoined ? <button type="button" className="secondary-button" onClick={() => { setSelectedTeam(team); selectMenu('팀 홈'); }}>팀 홈</button> : <button type="button" className="secondary-button" disabled={isFull || isPending || cannotJoinOtherTeam || joiningTeamId === team.id} onClick={() => handleJoinRequest(team.id)}>{joiningTeamId === team.id ? '신청 중...' : isPending ? '대기 중' : isFull ? '마감' : cannotJoinOtherTeam ? '가입 불가' : team.membershipStatus === 'REJECTED' ? '다시 신청' : '참가 신청'}</button>}</div></li>;
        })}</ul>}</>}

        {(activeMenu === '스페이스 대시보드' || (isInstructor && activeMenu === '팀 목록')) && <InstructorDashboard spaceId={selectedSpace?.id} isAuthorized={isInstructor}/>}

        {activeMenu !== '스페이스' && activeMenu !== '팀 목록' && activeMenu !== '스페이스 대시보드' && <section className="placeholder"><h1>{activeMenu}</h1><p>이 메뉴의 실제 기능은 다음 이슈에서 구현합니다.</p></section>}
      </main>
    </div>
    {modal === 'create' && <Modal title="스페이스 생성" submitLabel="생성" onClose={() => setModal(null)} onSubmit={handleSpaceSubmit} isSubmitting={isSubmitting} error={error}><label className="field-label" htmlFor="space-name">스페이스 이름</label><input id="space-name" autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="예: 캡스톤 디자인"/></Modal>}
    {modal === 'join' && <Modal title="스페이스 참가" submitLabel="참가" onClose={() => setModal(null)} onSubmit={handleSpaceSubmit} isSubmitting={isSubmitting} error={error}><label className="field-label" htmlFor="join-code">참여 코드</label><input id="join-code" autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="참여 코드 입력"/></Modal>}
    {modal === 'team' && <Modal title="새 팀 만들기" submitLabel="팀 생성" onClose={() => setModal(null)} onSubmit={handleTeamSubmit} isSubmitting={teamSubmitting} error={teamFormError}><div className="form-fields"><div><label className="field-label" htmlFor="team-name">팀 이름</label><input id="team-name" autoFocus value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="예: A팀"/></div><div><label className="field-label" htmlFor="team-capacity">팀 정원</label><input id="team-capacity" type="number" min="2" max="20" value={teamCapacity} onChange={(event) => setTeamCapacity(event.target.value)}/><p className="field-help">생성자는 자동으로 팀장이 됩니다.</p></div></div></Modal>}
  </div>;
}

export default App;

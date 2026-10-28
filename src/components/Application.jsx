import { useEffect, useRef, useState } from 'react';
import { BookOpen, Monitor, X } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { getCurrentUser, loginWithGoogle, logout } from '../api/auth.js';
import AppRoutes from './AppRoutes.jsx';
import { loginReturnPath } from '../lib/routes.js';
import { ErrorNotice } from './ui.jsx';
import { useInteractions } from '../hooks/useInteractions.js';
import { HeaderContext } from './HeaderContext.js';
import { invalidateSharedReads } from '../api/sharedReads.js';
import googleLogo from '../assets/google-g.svg';
import BrandLogo from './BrandLogo.jsx';
import { usePreviewGuide } from '../lib/previewGuideContext.js';
import HeaderActivityActions from './HeaderActivityActions.jsx';
import '../preview-controls.css';
import '../header-profile.css';

export default function Application({ previewRuntime }) {
  const {
    getMockState, getPreviewUser, previewRole, setPreviewRole,
    resetPreview, previewContext, getRagPreviewScenario, setRagPreviewScenario,
  } = previewRuntime || {};
  const guide = usePreviewGuide();
  const navigate = useNavigate();
  const location = useLocation();
  const preview = Boolean(previewRuntime);
  const prefix = preview ? '/preview' : '';
  const [user, setUser] = useState(() => (preview ? getPreviewUser() : null));
  const [checking, setChecking] = useState(!preview);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [scenario, setScenario] = useState(() =>
    preview ? getMockState(previewContext()).scenario : 'active',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [headerContext, setHeaderContext] = useState(null);
  const currentHeader =
    headerContext?.pathname === location.pathname
      ? headerContext
      : {
          scope: '워크스페이스',
          title: location.pathname.endsWith('/main')
            ? '내 스페이스'
            : '공간 불러오는 중',
          detail: '팀 프로젝트를 함께 만들어가는 공간',
        };
  const [sessionNotice, setSessionNotice] = useState('');
  const [previewSettingsOpen, setPreviewSettingsOpen] = useState(false);
  const previewControls = useRef(null);
  const previewToggle = useRef(null);
  const closePreviewSettings = () => {
    setPreviewSettingsOpen(false);
    previewToggle.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    setPreviewSettingsOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!previewSettingsOpen) return;
    previewControls.current?.querySelector('select')?.focus();
    const closeOutside = (event) => {
      if (!previewControls.current?.contains(event.target)) setPreviewSettingsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [previewSettingsOpen]);
  const { confirmDiscard } = useInteractions();
  useEffect(() => {
    let active = true;
    setChecking(true);
    setError(null);
    if (preview) setScenario(getMockState(previewContext()).scenario);
    const expired = () => {
      invalidateSharedReads();
      setUser(null);
      setSessionNotice('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
    };
    window.addEventListener('fairplay:session-expired', expired);
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setSessionNotice('');
        }
      })
      .catch((requestError) => {
        if (active && requestError.status !== 401) setError(requestError);
        if (active) setSessionNotice('');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      window.removeEventListener('fairplay:session-expired', expired);
    };
  }, [preview]);
  useEffect(() => {
    if (!preview) return;
    const refreshPreview = () => {
      invalidateSharedReads();
      setUser(getPreviewUser());
      setScenario(getMockState(previewContext()).scenario);
      setPreviewRevision((value) => value + 1);
    };
    window.addEventListener('fairplay:preview-updated', refreshPreview);
    return () => window.removeEventListener('fairplay:preview-updated', refreshPreview);
  }, [preview]);
  const authenticate = async () => {
    setBusy(true);
    setError(null);
    try {
      const currentUser = await loginWithGoogle();
      setUser(currentUser);
      setSessionNotice('');
      navigate(loginReturnPath(location.state?.returnTo), { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    if (!(await confirmDiscard())) return;
    if (preview) {
      guide?.stop();
      invalidateSharedReads();
      setUser(null);
      navigate('/', { replace: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await logout();
      setUser(null);
      setSessionNotice('');
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  if (checking || (preview && user?.id !== getPreviewUser().id))
    return (
      <main className="login-page">
        <section className="login-card" role="status">
          <span className="loading-spinner" />
          <p>로그인 상태를 확인하고 있습니다.</p>
        </section>
      </main>
    );
  if (!user && location.pathname !== '/login')
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  if (user && location.pathname === '/login')
    return <Navigate to={loginReturnPath(location.state?.returnTo)} replace />;
  if (!user || location.pathname === '/preview/login')
    return (
      <main className="login-page">
        <button className="login-home-link" onClick={() => navigate('/')}>
          ← Fairplay 소개로
        </button>
        <section className="login-card">
          <div className="login-introduction">
            <h1 className="login-brand"><BrandLogo /></h1>
            <p className="login-description">
              팀 프로젝트의 역할과 수행 과정을 기록하고,
              <br />
              기여도를 근거와 함께 확인하세요.
            </p>
            <ol className="login-benefits">
              <li>작업을 나누고 수행 내용을 기록</li>
              <li>산출물을 등록하고 직접 완료</li>
              <li>협업을 돌아보고 기여도 확인</li>
            </ol>
          </div>
          <div className="login-actions">
            <h2>함께 만드는 프로젝트</h2>
            <p>로그인하고 내 작업 공간을 시작하세요.</p>
            <button
              className="google-button"
              disabled={busy || preview}
              onClick={authenticate}
            >
              <img
                className="google-login-logo"
                src={googleLogo}
                alt=""
                aria-hidden="true"
                width="20"
                height="20"
              />
              <span>
                {preview
                  ? 'Google 로그인 · 실제 서비스에서 연결'
                  : busy
                    ? '로그인 연결 중…'
                    : 'Google로 계속하기'}
              </span>
            </button>
            <button
              className="secondary-button preview-entry"
              onClick={() => navigate('/preview/main?guide=start')}
            >
              로그인 없이 사용자 가이드
            </button>
            <p className="field-help">
              개발·조사·발표·행사 등 다양한 팀 프로젝트에 사용할 수 있습니다.
            </p>
            {sessionNotice && <p role="status">{sessionNotice}</p>}
            <ErrorNotice error={error} />
          </div>
        </section>
      </main>
    );
  return (
    <HeaderContext.Provider value={setHeaderContext}>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <button
              className="brand-button"
              aria-label="Fairplay"
              onClick={() => navigate(`${prefix}/main`)}
            >
              <BrandLogo decorative />
            </button>
          </div>
          <div className="context-info" aria-label="현재 화면 정보">
            <span className="context-dot" aria-hidden="true" />
            <div className="header-context-copy">
              <strong title={currentHeader.spaceName || currentHeader.title}>{currentHeader.spaceName || currentHeader.title}</strong>
              {currentHeader.roleLabel && (
                <span className="header-context-role" title={`현재 화면 역할: ${currentHeader.roleLabel}`}>
                  {currentHeader.roleLabel}
                </span>
              )}
            </div>
          </div>
          <div className="profile-area">
            {preview && <button className="preview-toggle preview-guide-entry" aria-label="사용자 가이드" title="사용자 가이드" onClick={guide?.open}>
              <BookOpen size={15} aria-hidden="true" /><span>사용자 가이드</span>
            </button>}
            {preview && (
              <div
                className="preview-toolbar"
                ref={previewControls}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    closePreviewSettings();
                  }
                }}
                onBlur={(event) => {
                  if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                    setPreviewSettingsOpen(false);
                  }
                }}
              >
                <button
                  className="preview-toggle"
                  type="button"
                  ref={previewToggle}
                  aria-label="미리보기 설정"
                  aria-expanded={previewSettingsOpen}
                  aria-controls="preview-settings-panel"
                  title="미리보기 설정"
                  onClick={() => setPreviewSettingsOpen((value) => !value)}
                >
                  <Monitor size={15} />
                  <span>미리보기</span>
                </button>
                <section
                  className="preview-popover"
                  id="preview-settings-panel"
                  role="region"
                  aria-labelledby="preview-settings-title"
                  hidden={!previewSettingsOpen}
                >
                  <header className="preview-popover-heading">
                    <h2 id="preview-settings-title">미리보기 설정</h2>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="미리보기 설정 닫기"
                      onClick={closePreviewSettings}
                    ><X size={17} /></button>
                  </header>
                  <p className="preview-popover-note">모든 데이터는 예시이며 서버에 전송되지 않습니다.</p>
                  <div className="preview-controls">
                    <label>
                      역할
                      <select
                        aria-label="미리보기 역할"
                        value={previewRole()}
                        onChange={async (event) => {
                          const nextRole = event.target.value;
                          if (!(await confirmDiscard())) return;
                          if (guide && !(await guide.endForSettings())) return;
                          invalidateSharedReads();
                          setPreviewRole(nextRole);
                          setUser(getPreviewUser());
                          setPreviewRevision((value) => value + 1);
                          navigate('/preview/main');
                        }}
                      >
                        <option value="leader">팀 리더</option>
                        <option value="participant">
                          스페이스 참여자·팀 미가입
                        </option>
                        <option value="member">일반 담당자</option>
                        <option value="teammate">다른 팀원</option>
                        <option value="manager">스페이스 관리자</option>
                      </select>
                    </label>
                    <label>
                      상황
                      <select
                        aria-label="미리보기 상황"
                        value={scenario}
                        onChange={async (event) => {
                          const nextScenario = event.target.value;
                          if (!(await confirmDiscard())) return;
                          if (guide && !(await guide.endForSettings())) return;
                          invalidateSharedReads();
                          setScenario(nextScenario);
                          resetPreview(nextScenario);
                          setPreviewRevision((value) => value + 1);
                        }}
                      >
                        <option value="active">평가 진행 중</option>
                        <option value="setup">평가 시작 전</option>
                        <option value="building">팀 빌딩 진행 중</option>
                        <option value="evaluated">평가 완료·리포트 미생성</option>
                        <option value="review">리포트 검토</option>
                        <option value="published">리포트 공개 완료</option>
                      </select>
                    </label>
                    {location.pathname.endsWith('/materials-search') && (
                      <label>
                        자료 검색
                        <select
                          aria-label="자료 검색 미리보기 상황"
                          value={getRagPreviewScenario()}
                          onChange={async (event) => {
                            const nextScenario = event.target.value;
                            if (!(await confirmDiscard())) return;
                            setRagPreviewScenario(nextScenario);
                            setPreviewRevision((value) => value + 1);
                          }}
                        >
                          <option value="ready">검색 가능</option>
                          <option value="no-evidence">관련 근거 없음</option>
                          <option value="preparing">자료 준비 중</option>
                          <option value="failed">준비 실패</option>
                          <option value="disabled">기능 비활성화</option>
                        </select>
                      </label>
                    )}
                    <button
                      className="secondary-button"
                      onClick={async () => {
                        if (!(await confirmDiscard())) return;
                        if (guide && !(await guide.endForSettings())) return;
                        invalidateSharedReads();
                        resetPreview(scenario);
                        setPreviewRevision((value) => value + 1);
                      }}
                    >
                      예시 초기화
                    </button>
                  </div>
                </section>
              </div>
            )}
            <div className="profile-account-group">
              <HeaderActivityActions />
              <span className="profile-avatar" aria-hidden="true">
                {user.name?.slice(0, 1)}
              </span>
              <span className="profile-identity">
                <span className="profile-name">{user.name}</span>
              </span>
            </div>
            <button className="logout-button" disabled={busy} onClick={signOut}>
              {preview ? '미리보기 종료' : '로그아웃'}
            </button>
          </div>
        </header>
        {error && <ErrorNotice error={error} />}
        <AppRoutes
          key={`${user.id}-${previewRevision}`}
          user={user}
          prefix={prefix}
        />
      </div>
    </HeaderContext.Provider>
  );
}

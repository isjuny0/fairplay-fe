import { getMockState } from './mock/planned.js';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { getCurrentUser, loginWithGoogle, logout } from './api/auth.js';
import AppRoutes from './components/AppRoutes.jsx';
import { loginReturnPath } from './lib/routes.js';
import { ErrorNotice } from './components/ui.jsx';
import { useInteractions } from './hooks/useInteractions.js';
import {
  getPreviewUser,
  isPreviewPath,
  previewRole,
  setPreviewRole,
  resetPreview,
  previewContext,
} from './mock/preview.js';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const preview = isPreviewPath(location.pathname);
  const prefix = preview ? '/preview' : '';
  const [user, setUser] = useState(() => (preview ? getPreviewUser() : null));
  const [checking, setChecking] = useState(!preview);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [scenario, setScenario] = useState(() =>
    preview ? getMockState(previewContext()).scenario : 'active',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [previewSettingsOpen, setPreviewSettingsOpen] = useState(
    () => window.innerWidth > 720,
  );
  const { confirmDiscard } = useInteractions();
  useEffect(() => {
    let active = true;
    setChecking(true);
    setError(null);
    if (preview) setScenario(getMockState(previewContext()).scenario);
    const expired = () => {
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
  if (!user && location.pathname !== '/')
    return (
      <Navigate
        to="/"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  if (!user || location.pathname === '/preview/login')
    return (
      <main className="login-page">
        <section className="login-card">
          <span className="logo-mark">F</span>
          <h1>Fairplay</h1>
          <p className="login-description">
            팀 프로젝트의 역할과 수행 과정을 기록하고, 기여도를 근거와 함께
            확인하세요.
          </p>
          <ol className="login-benefits">
            <li>작업을 나누고 수행 내용을 기록</li>
            <li>산출물을 확인하고 완료 승인</li>
            <li>협업을 돌아보고 기여도 확인</li>
          </ol>
          <button
            className="google-button"
            disabled={busy || preview}
            onClick={authenticate}
          >
            {preview
              ? 'Google 로그인 · 실제 서비스에서 연결'
              : busy
                ? '로그인 연결 중…'
                : 'Google로 계속하기'}
          </button>
          <button
            className="secondary-button preview-entry"
            onClick={() => navigate('/preview/main')}
          >
            로그인 없이 화면 미리보기
          </button>
          <p className="field-help">
            개발·조사·발표·행사 등 다양한 팀 프로젝트에 사용할 수 있습니다.
          </p>
          {sessionNotice && <p role="status">{sessionNotice}</p>}
          <ErrorNotice error={error} />
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="logo-mark">F</span>
          <button
            className="brand-button wordmark"
            onClick={() => navigate(`${prefix}/main`)}
          >
            Fairplay
          </button>
        </div>
        <div className="context-info">
          <span className="context-dot" />팀 프로젝트 공간
        </div>
        <div className="profile-area">
          <span className="profile-avatar" aria-hidden="true">
            {user.name?.slice(0, 1)}
          </span>
          <span className="profile-name">{user.name}</span>
          <button className="logout-button" disabled={busy} onClick={signOut}>
            {preview ? '미리보기 종료' : '로그아웃'}
          </button>
        </div>
      </header>
      {preview && (
        <div className="preview-toolbar">
          <div>
            <span className="mock-tag">화면 미리보기</span>
            <span>모든 데이터는 예시이며 서버에 전송되지 않습니다.</span>
          </div>
          <details
            className="preview-settings"
            open={previewSettingsOpen}
            onToggle={(event) =>
              setPreviewSettingsOpen(event.currentTarget.open)
            }
          >
            <summary>미리보기 설정</summary>
            <div className="preview-controls">
              <label>
                역할
                <select
                  aria-label="미리보기 역할"
                  value={previewRole()}
                  onChange={async (event) => {
                    const nextRole = event.target.value;
                    if (!(await confirmDiscard())) return;
                    setPreviewRole(nextRole);
                    setUser(getPreviewUser());
                    setPreviewRevision((value) => value + 1);
                    navigate('/preview/main');
                  }}
                >
                  <option value="leader">팀 리더</option>
                  <option value="participant">스페이스 참여자·팀 미가입</option>
                  <option value="member">일반 담당자</option>
                  <option value="reviewer">부리더·승인자</option>
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
                    setScenario(nextScenario);
                    resetPreview(nextScenario);
                    setPreviewRevision((value) => value + 1);
                  }}
                >
                  <option value="active">평가 진행 중</option>
                  <option value="setup">평가 시작 전</option>
                  <option value="building">팀 빌딩 진행 중</option>
                  <option value="review">리포트 검토</option>
                  <option value="published">리포트 공개 완료</option>
                </select>
              </label>
              <button
                className="secondary-button"
                onClick={async () => {
                  if (!(await confirmDiscard())) return;
                  resetPreview(scenario);
                  setPreviewRevision((value) => value + 1);
                }}
              >
                예시 초기화
              </button>
            </div>
          </details>
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      <AppRoutes
        key={`${user.id}-${previewRevision}`}
        user={user}
        prefix={prefix}
      />
    </div>
  );
}

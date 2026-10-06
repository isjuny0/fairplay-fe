import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { getCurrentUser, loginWithGoogle, logout } from './api/auth.js';
import AppRoutes from './components/AppRoutes.jsx';
import { loginReturnPath } from './lib/routes.js';
import { ErrorNotice } from './components/ui.jsx';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  useEffect(() => {
    let active = true;
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
  }, []);
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
  if (checking)
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
  if (!user)
    return (
      <main className="login-page">
        <section className="login-card">
          <span className="logo-mark">F</span>
          <h1>Fairplay</h1>
          <p className="login-description">
            함께 맡고, 기록하고, 완성하는 팀 프로젝트
          </p>
          <button
            className="google-button"
            disabled={busy}
            onClick={authenticate}
          >
            {busy ? '로그인 연결 중…' : 'Google로 계속하기'}
          </button>
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
            onClick={() => navigate('/main')}
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
            로그아웃
          </button>
        </div>
      </header>
      {error && <ErrorNotice error={error} />}
      <AppRoutes user={user} />
    </div>
  );
}

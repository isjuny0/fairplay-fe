import { useEffect, useState } from 'react';
import { getCurrentUser, loginWithGoogle, logout } from './api/auth.js';
import Spaces from './components/Spaces.jsx';
import SpaceWorkspace from './components/SpaceWorkspace.jsx';
import { ErrorNotice } from './components/ui.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [spaceId, setSpaceId] = useState(null);
  useEffect(() => {
    let active = true;
    const expired = () => {
      setUser(null);
      setSpaceId(null);
      setSessionNotice('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      window.history.replaceState({}, '', '/');
    };
    window.addEventListener('fairplay:session-expired', expired);
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          window.history.replaceState({}, '', '/main');
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
      window.history.replaceState({}, '', '/main');
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
      setSpaceId(null);
      setSessionNotice('');
      window.history.replaceState({}, '', '/');
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
            onClick={() => setSpaceId(null)}
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
      {spaceId == null ? (
        <main className="main-content spaces-main">
          <Spaces onSelect={setSpaceId} />
        </main>
      ) : (
        <SpaceWorkspace
          key={spaceId}
          spaceId={spaceId}
          user={user}
          onBack={() => setSpaceId(null)}
        />
      )}
    </div>
  );
}

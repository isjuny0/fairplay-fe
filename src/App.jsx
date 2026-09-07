import { useEffect, useState } from 'react';

const DEFAULT_API_BASE_URL = 'http://localhost:8080';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="google-icon">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

function App() {
  const [screen, setScreen] = useState(
    window.location.pathname === '/main' ? 'main' : 'login',
  );

  useEffect(() => {
    const handlePopState = () => {
      setScreen(window.location.pathname === '/main' ? 'main' : 'login');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  };

  if (screen === 'main') {
    return (
      <div className="app-shell">
        <header className="main-header">
          <span className="wordmark">Fairplay</span>
          <button type="button" className="logout-button" onClick={handleLogout}>
            로그아웃
          </button>
        </header>
        <main className="main-content">
          <h1>내 스페이스</h1>
          <section className="empty-state" aria-label="스페이스 목록">
            <p>참여 중인 스페이스가 없습니다.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="로그인">
        <p className="login-description login-prompt">Google 계정으로 로그인해 주세요.</p>
        <button type="button" className="google-button" onClick={handleGoogleLogin}>
          <GoogleIcon />
          <span>Google로 계속하기</span>
        </button>
        <p className="terms">
          계속하면 Fairplay의 이용약관과 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </section>
    </main>
  );
}

export default App;

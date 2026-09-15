const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
let googleScriptRequest;

function getErrorMessage(result, fallback) {
  return result?.message || fallback;
}

async function readJson(response) {
  return response.json().catch(() => null);
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (googleScriptRequest) return googleScriptRequest;

  googleScriptRequest = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    const script = existingScript || document.createElement('script');

    const handleLoad = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error('Google 로그인 서비스를 불러오지 못했습니다.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Google 로그인 서비스를 불러오지 못했습니다.')), { once: true });

    if (!existingScript) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return googleScriptRequest;
}

async function requestGoogleCode() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google Client ID가 설정되지 않았습니다. .env 파일을 확인해 주세요.');

  const google = await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: (response) => {
        if (response?.code) resolve(response.code);
        else reject(new Error('Google 인증 코드를 받지 못했습니다.'));
      },
      error_callback: (error) => {
        const message = error?.type === 'popup_closed'
          ? 'Google 로그인이 취소되었습니다.'
          : 'Google 인증에 실패했습니다.';
        reject(new Error(message));
      },
    });

    client.requestCode();
  });
}

async function getCsrfToken() {
  const response = await fetch(`${apiBaseUrl}/api/auth/csrf`, { credentials: 'include' });
  const result = await readJson(response);

  if (!response.ok) throw new Error(getErrorMessage(result, '보안 토큰을 발급받지 못했습니다.'));
  if (!result?.headerName || !result?.token) throw new Error('백엔드의 CSRF 응답 형식을 확인해 주세요.');

  return result;
}

export async function loginWithGoogle() {
  const code = await requestGoogleCode();
  const csrf = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}/api/auth/google`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ code }),
  });
  const result = await readJson(response);

  if (!response.ok) throw new Error(getErrorMessage(result, '백엔드 로그인 처리에 실패했습니다.'));
  return result;
}

export async function getCurrentUser() {
  const response = await fetch(`${apiBaseUrl}/api/me`, { credentials: 'include' });
  const result = await readJson(response);
  if (!response.ok) throw new Error(getErrorMessage(result, '로그인이 필요합니다.'));
  return result;
}

export async function logout() {
  const csrf = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { [csrf.headerName]: csrf.token },
  });

  if (!response.ok) {
    const result = await readJson(response);
    throw new Error(getErrorMessage(result, '로그아웃하지 못했습니다.'));
  }
}

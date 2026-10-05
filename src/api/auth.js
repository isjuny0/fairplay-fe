import { apiRequest, clearCsrfToken, refreshCsrfToken } from './client.js';
const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let googleScriptRequest;

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
    script.addEventListener(
      'error',
      () => {
        googleScriptRequest = undefined;
        script.remove();
        reject(new Error('Google 로그인 서비스를 불러오지 못했습니다.'));
      },
      { once: true },
    );

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
  if (!clientId)
    throw new Error(
      'Google Client ID가 설정되지 않았습니다. .env 파일을 확인해 주세요.',
    );

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
        const message =
          error?.type === 'popup_closed'
            ? 'Google 로그인이 취소되었습니다.'
            : 'Google 인증에 실패했습니다.';
        reject(new Error(message));
      },
    });

    client.requestCode();
  });
}

export async function loginWithGoogle() {
  await refreshCsrfToken();
  const code = await requestGoogleCode();
  const user = await apiRequest('/api/auth/google', {
    method: 'POST',
    body: { code },
  });
  clearCsrfToken();
  await refreshCsrfToken();
  return user;
}
export const getCurrentUser = () => apiRequest('/api/me');
export async function logout() {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  clearCsrfToken();
}

const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL || '').replace(
  /\/$/,
  '',
);
let csrfToken;
let csrfRequest;
export class ApiError extends Error {
  constructor(status, result) {
    super(
      result?.message ||
        '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    this.status = status;
    this.code = result?.code;
  }
}
export function clearCsrfToken() {
  csrfToken = undefined;
}
export async function refreshCsrfToken() {
  if (csrfRequest) return csrfRequest;
  csrfRequest = (async () => {
    const response = await fetch(`${apiBaseUrl}/api/auth/csrf`, {
      credentials: 'include',
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, result);
    if (!result?.headerName || !result?.token)
      throw new Error('보안 토큰을 발급받지 못했습니다.');
    csrfToken = result;
    return result;
  })();
  try {
    return await csrfRequest;
  } finally {
    csrfRequest = undefined;
  }
}
export async function apiRequest(
  path,
  { method = 'GET', body, responseType = 'json' } = {},
  retryCsrf = true,
) {
  const headers = {};
  if (!['GET', 'HEAD'].includes(method)) {
    const csrf = csrfToken || (await refreshCsrfToken());
    headers[csrf.headerName] = csrf.token;
  }
  const isMultipart = body instanceof FormData;
  if (body !== undefined && !isMultipart)
    headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers,
    body:
      body === undefined
        ? undefined
        : isMultipart
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    if (
      response.status === 403 &&
      result?.code === 'INVALID_CSRF_TOKEN' &&
      retryCsrf
    ) {
      clearCsrfToken();
      await refreshCsrfToken();
      return apiRequest(path, { method, body, responseType }, false);
    }
    if (response.status === 401) {
      clearCsrfToken();
      globalThis.window?.dispatchEvent(new Event('fairplay:session-expired'));
    }
    throw new ApiError(response.status, result);
  }
  if (response.status === 204) return null;
  return responseType === 'blob' ? response.blob() : response.json();
}

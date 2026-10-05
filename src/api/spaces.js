import { apiRequest } from './client.js';
export const listSpaces = () => apiRequest('/api/spaces');
export const getSpace = (id) => apiRequest(`/api/spaces/${id}`);
export const createSpace = (body) =>
  apiRequest('/api/spaces', { method: 'POST', body });
export const joinSpace = (code) =>
  apiRequest('/api/spaces/join', { method: 'POST', body: { code } });
export const updateTeamBuildingPeriod = (id, body) =>
  apiRequest(`/api/spaces/${id}/team-building-period`, {
    method: 'PATCH',
    body,
  });
export const getJoinCode = (id) => apiRequest(`/api/spaces/${id}/join-code`);
export const createJoinCode = (id, expirationMinutes) =>
  apiRequest(`/api/spaces/${id}/join-code`, {
    method: 'POST',
    body: { expirationMinutes },
  });
export const rotateJoinCode = (id, expirationMinutes) =>
  apiRequest(`/api/spaces/${id}/join-code/rotate`, {
    method: 'POST',
    body: { expirationMinutes },
  });
export const revokeJoinCode = (id) =>
  apiRequest(`/api/spaces/${id}/join-code/revoke`, { method: 'POST' });

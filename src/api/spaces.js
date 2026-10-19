import { apiRequest } from './client.js';
import { sharedRead } from './sharedReads.js';
export const listSpaces = () =>
  sharedRead('/api/spaces', () => apiRequest('/api/spaces'), 15_000);
export const getSpace = (id) =>
  sharedRead(`/api/spaces/${id}`, () => apiRequest(`/api/spaces/${id}`));
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
export const revokeJoinCode = (id) =>
  apiRequest(`/api/spaces/${id}/join-code/revoke`, { method: 'POST' });

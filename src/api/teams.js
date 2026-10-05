import { apiRequest } from './client.js';
export const listTeams = (spaceId) =>
  apiRequest(`/api/spaces/${spaceId}/teams`);
export const getTeam = (teamId) => apiRequest(`/api/teams/${teamId}`);
export const createTeam = (spaceId, name) =>
  apiRequest(`/api/spaces/${spaceId}/teams`, {
    method: 'POST',
    body: { name },
  });
export const requestTeamJoin = (teamId) =>
  apiRequest(`/api/teams/${teamId}/applications`, { method: 'POST' });
export const getTeamMembers = (teamId) =>
  apiRequest(`/api/teams/${teamId}/members`);
export const getTeamApplications = (teamId) =>
  apiRequest(`/api/teams/${teamId}/applications?status=PENDING`);
export const reviewTeamApplication = (applicationId, status) =>
  apiRequest(`/api/team-applications/${applicationId}`, {
    method: 'PATCH',
    body: { status },
  });
export const assignTeamDeputy = (teamId, userId) =>
  apiRequest(`/api/teams/${teamId}/deputy`, {
    method: 'PATCH',
    body: { userId },
  });

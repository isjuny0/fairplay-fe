import { apiRequest } from './client.js';

export const getMemberContributions = (teamId, userId) =>
  apiRequest(`/api/teams/${teamId}/members/${userId}/contributions`);

export const getManagerDashboard = (spaceId, teamId) =>
  apiRequest(
    `/api/spaces/${spaceId}/manager-dashboard${teamId ? `?${new URLSearchParams({ teamId })}` : ''}`,
  );

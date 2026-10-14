import { apiRequest } from './client.js';

export const getManagerDashboard = (spaceId, teamId) =>
  apiRequest(
    `/api/spaces/${spaceId}/manager-dashboard${teamId ? `?${new URLSearchParams({ teamId })}` : ''}`,
  );

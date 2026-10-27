import { apiRequest } from './client.js';

export const getTeamReport = (teamId) =>
  apiRequest(`/api/teams/${teamId}/report`);
export const generateTeamReport = (teamId, weights) =>
  apiRequest(`/api/teams/${teamId}/report`, { method: 'POST', body: weights });
export const publishReport = (reportId) =>
  apiRequest(`/api/reports/${reportId}/publish`, { method: 'POST' });

import { apiRequest } from './client.js';

export const getTeamBriefing = (teamId) =>
  apiRequest(`/api/teams/${teamId}/briefing`);

export const acknowledgeTeamBriefing = (teamId, ackToken, itemId) =>
  apiRequest(`/api/teams/${teamId}/briefing/acknowledge`, {
    method: 'POST',
    body: { ackToken, ...(itemId === undefined ? {} : { itemId }) },
  });

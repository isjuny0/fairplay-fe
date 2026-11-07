import { apiRequest } from './client.js';

export const askTeamMaterials = (teamId, question) =>
  apiRequest(`/api/teams/${teamId}/rag/questions`, {
    method: 'POST',
    body: { question },
  });
export const getRagIndexStatus = (teamId, page = 0, size = 20) =>
  apiRequest(
    `/api/teams/${teamId}/rag/index-status?${new URLSearchParams({ page, size })}`,
  );
export const getRagSource = (teamId, deliverableId, expectedVersion, pageNumber) => {
  const params = new URLSearchParams({ expectedVersion });
  if (pageNumber != null) params.set('pageNumber', pageNumber);
  return apiRequest(`/api/teams/${teamId}/rag/sources/${deliverableId}?${params}`);
};

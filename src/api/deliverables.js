import { apiRequest } from './client.js';
export const listDeliverables = (
  teamId,
  { taskId, page = 0, size = 20 } = {},
) => {
  const query = new URLSearchParams({ page, size });
  if (taskId != null) query.set('taskId', taskId);
  return apiRequest(`/api/teams/${teamId}/deliverables?${query}`);
};
export const createDeliverable = (teamId, body) =>
  apiRequest(`/api/teams/${teamId}/deliverables`, { method: 'POST', body });
export const uploadDeliverable = (teamId, input, file) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(input))
    if (value != null) body.append(name, value);
  body.append('file', file);
  return apiRequest(`/api/teams/${teamId}/deliverables/files`, {
    method: 'POST',
    body,
  });
};
export const updateDeliverable = (id, metadata, file) => {
  if (!file)
    return apiRequest(`/api/deliverables/${id}`, {
      method: 'PATCH',
      body: metadata,
    });
  const body = new FormData();
  body.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  body.append('file', file);
  return apiRequest(`/api/deliverables/${id}`, { method: 'PATCH', body });
};
export const deleteDeliverable = (id, expectedVersion) =>
  apiRequest(`/api/deliverables/${id}?expectedVersion=${expectedVersion}`, {
    method: 'DELETE',
  });
export const downloadDeliverable = (id) =>
  apiRequest(`/api/deliverables/${id}/file`, { responseType: 'blob' });

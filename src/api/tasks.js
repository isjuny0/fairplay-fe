import { apiRequest } from './client.js';
export const listTasks = (teamId) => apiRequest(`/api/teams/${teamId}/tasks`);
export const getTask = (taskId) => apiRequest(`/api/tasks/${taskId}`);
export const createTask = (teamId, body) =>
  apiRequest(`/api/teams/${teamId}/tasks`, { method: 'POST', body });
export const updateTask = (taskId, body) =>
  apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body });
export const deleteTask = (taskId, expectedVersion) =>
  apiRequest(`/api/tasks/${taskId}?expectedVersion=${expectedVersion}`, {
    method: 'DELETE',
  });
export const updateContribution = (taskId, body) =>
  apiRequest(`/api/tasks/${taskId}/contribution`, { method: 'PATCH', body });
export const assignCompletionReviewer = (taskId, body) =>
  apiRequest(`/api/tasks/${taskId}/completion-reviewer`, {
    method: 'PATCH',
    body,
  });

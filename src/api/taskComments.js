import { apiRequest } from './client.js';

export const listTaskComments = (taskId, page = 0, size = 20) =>
  apiRequest(`/api/tasks/${taskId}/comments?page=${page}&size=${size}`);
export const createTaskComment = (taskId, content) =>
  apiRequest(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: { content },
  });
export const updateTaskComment = (commentId, content) =>
  apiRequest(`/api/task-comments/${commentId}`, {
    method: 'PATCH',
    body: { content },
  });
export const deleteTaskComment = (commentId) =>
  apiRequest(`/api/task-comments/${commentId}`, { method: 'DELETE' });

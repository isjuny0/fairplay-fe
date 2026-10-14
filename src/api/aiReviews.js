import { apiRequest } from './client.js';

export const getAiReview = (taskId) =>
  apiRequest(`/api/tasks/${taskId}/ai-review`);
export const requestAiReview = (taskId) =>
  apiRequest(`/api/tasks/${taskId}/ai-review`, { method: 'POST' });

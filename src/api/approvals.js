import { apiRequest } from './client.js';
export const listApprovals = (teamId, status = 'PENDING') =>
  apiRequest(`/api/teams/${teamId}/approvals?status=${status}`);
export const getApprovalHistory = (taskId) =>
  apiRequest(`/api/tasks/${taskId}/approvals`);
export const requestCompletion = (taskId, expectedVersion) =>
  apiRequest(`/api/tasks/${taskId}/completion-requests`, {
    method: 'POST',
    body: { expectedVersion },
  });
export const approveCompletion = (id) =>
  apiRequest(`/api/approvals/${id}/approve`, { method: 'POST' });
export const rejectCompletion = (id, reason) =>
  apiRequest(`/api/approvals/${id}/reject`, {
    method: 'POST',
    body: { reason },
  });

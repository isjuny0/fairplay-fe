import { apiRequest } from './client.js';

export const listEvaluationRounds = (spaceId) =>
  apiRequest(`/api/spaces/${spaceId}/evaluation-rounds`);
export const createEvaluationRound = (spaceId, input) =>
  apiRequest(`/api/spaces/${spaceId}/evaluation-rounds`, {
    method: 'POST',
    body: input,
  });
export const updateEvaluationRound = (roundId, input) =>
  apiRequest(`/api/evaluation-rounds/${roundId}`, {
    method: 'PATCH',
    body: input,
  });
export const openEvaluationRound = (roundId) =>
  apiRequest(`/api/evaluation-rounds/${roundId}/open`, { method: 'POST' });
export const listPeerTargets = (roundId) =>
  apiRequest(`/api/evaluation-rounds/${roundId}/targets`);
export const getMyPeerResponses = (roundId) =>
  apiRequest(`/api/evaluation-rounds/${roundId}/responses/me`);
export const savePeerResponse = (roundId, targetId, input) =>
  apiRequest(`/api/evaluation-rounds/${roundId}/responses/${targetId}`, {
    method: 'PUT',
    body: input,
  });
export const submitPeerEvaluation = (roundId) =>
  apiRequest(`/api/evaluation-rounds/${roundId}/submit`, { method: 'POST' });
export const getMidFeedback = (teamId) =>
  apiRequest(`/api/teams/${teamId}/mid-feedback`);

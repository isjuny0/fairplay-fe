import { apiRequest } from './client.js';
import { sharedRead } from './sharedReads.js';
export const listTeams = (spaceId) =>
  sharedRead(`/api/spaces/${spaceId}/teams`, () =>
    apiRequest(`/api/spaces/${spaceId}/teams`),
  );
export const getTeam = (teamId) =>
  sharedRead(`/api/teams/${teamId}`, () => apiRequest(`/api/teams/${teamId}`));
export const createTeam = (spaceId, name) =>
  apiRequest(`/api/spaces/${spaceId}/teams`, {
    method: 'POST',
    body: { name },
  });
export const requestTeamJoin = (teamId) =>
  apiRequest(`/api/teams/${teamId}/applications`, { method: 'POST' });
export const getTeamMembers = (teamId) =>
  sharedRead(
    `/api/teams/${teamId}/members`,
    () => apiRequest(`/api/teams/${teamId}/members`),
    15_000,
  );
export const getTeamApplications = (teamId) =>
  apiRequest(`/api/teams/${teamId}/applications?status=PENDING`);
export const reviewTeamApplication = (applicationId, status) =>
  apiRequest(`/api/team-applications/${applicationId}`, {
    method: 'PATCH',
    body: { status },
  });
export const assignTeamDeputy = (teamId, userId) =>
  apiRequest(`/api/teams/${teamId}/deputy`, {
    method: 'PATCH',
    body: { userId },
  });
export const createTeamDeletionRequest = (teamId) =>
  apiRequest(`/api/teams/${teamId}/deletion-requests`, { method: 'POST' });
export const getTeamDeletionRequest = (teamId) =>
  apiRequest(`/api/teams/${teamId}/deletion-request`);
export async function getTeamWorkContext(teamId) {
  const [team, members, deletion] = await Promise.all([
    getTeam(teamId),
    getTeamMembers(teamId),
    getTeamDeletionRequest(teamId).catch((error) => {
      if (
        error.status === 404 &&
        error.code === 'TEAM_DELETION_REQUEST_NOT_FOUND'
      )
        return null;
      throw error;
    }),
  ]);
  return {
    team: {
      ...team,
      workFrozen: Boolean(deletion?.workFrozen),
      workStateUnknown: false,
    },
    members,
  };
}
export const updateTeamDeletionConsent = (requestId, agree) =>
  apiRequest(`/api/team-deletion-requests/${requestId}/consent`, {
    method: 'PUT',
    body: { agree },
  });
export const deleteTeam = (teamId, deletionRequestId, expectedVersion) => {
  const query = new URLSearchParams({ deletionRequestId, expectedVersion });
  return apiRequest(`/api/teams/${teamId}?${query}`, { method: 'DELETE' });
};
export const leaveTeam = (teamId, nextLeaderId) => {
  const query = nextLeaderId ? `?${new URLSearchParams({ nextLeaderId })}` : '';
  return apiRequest(`/api/teams/${teamId}/members/me${query}`, {
    method: 'DELETE',
  });
};

export const getMyWorkSummary = (teamId) =>
  apiRequest(`/api/teams/${teamId}/my-work-summary`);

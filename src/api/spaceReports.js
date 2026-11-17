import { apiRequest, ApiError } from './client.js';
import { validReportWeights } from '../lib/reportWeights.js';

export const reportBlockLabels = {
  NO_TEAMS: '리포트를 만들 팀이 없습니다.',
  ROUNDS_NOT_CLOSED: '중간·최종 평가를 모두 마감해 주세요.',
  PARTICIPANTS_MISMATCH: '중간·최종 평가의 참여 팀원 구성이 다릅니다.',
  TEAM_TOO_SMALL: '평가 참여 팀원이 2명 이상이어야 합니다.',
  PEER_EVALUATIONS_INCOMPLETE: '필수 동료 평가 제출이 완료되지 않았습니다.',
  REPORT_INPUT_INCOMPLETE: '계산에 필요한 작업·평가 입력을 확인해 주세요.',
  REPORT_UNCALCULABLE: '기여도를 계산할 작업량 또는 평가 점수가 부족합니다.',
  REPORT_NOT_GENERATED: '리포트를 먼저 생성해 주세요.',
};
export const reportBlockMessage = (code) => reportBlockLabels[code] || '리포트 처리 조건을 확인해 주세요.';
const validReasons = (value) => Array.isArray(value) && value.every((reason) => typeof reason === 'string');
const validReadiness = (value) => typeof value.canGenerate === 'boolean' && typeof value.canPublish === 'boolean'
  && validReasons(value.generationBlockReasons) && validReasons(value.publicationBlockReasons);

// SpaceReportResponse: validate the server contract before rendering management actions.
export async function getSpaceReports(spaceId) {
  const result = await apiRequest(`/api/spaces/${spaceId}/reports`);
  if (!result || result.spaceId !== spaceId || !Array.isArray(result.teams)
    || ![result.totalTeamCount, result.generatedTeamCount, result.publishedTeamCount].every((count) => Number.isInteger(count) && count >= 0)
    || !validReportWeights(result.weights) || typeof result.weightsConfirmed !== 'boolean' || !validReadiness(result)
    || result.totalTeamCount !== result.teams.length
    || result.teams.some((team) => !team || !Number.isInteger(team.teamId) || typeof team.teamName !== 'string'
      || !validReadiness(team) || (team.reportId != null && (!Number.isInteger(team.reportId) || !['UNPUBLISHED', 'PUBLISHED'].includes(team.reportStatus)))
      || (team.reportId == null && team.reportStatus != null))
    || new Set(result.teams.map((team) => team.teamId)).size !== result.teams.length
    || result.generatedTeamCount !== result.teams.filter((team) => team.reportId != null).length
    || result.publishedTeamCount !== result.teams.filter((team) => team.reportStatus === 'PUBLISHED').length
    || (result.generatedTeamCount > 0 && !result.weightsConfirmed)) {
    throw new ApiError(502, { code: 'REPORT_MANAGEMENT_INVALID', message: '리포트 관리 현황을 확인하지 못했습니다. 새로고침해 주세요.' });
  }
  return result;
}
export const generateSpaceReports = (spaceId, weights) =>
  apiRequest(`/api/spaces/${spaceId}/reports`, { method: 'POST', body: weights });
export const publishSpaceReports = (spaceId) =>
  apiRequest(`/api/spaces/${spaceId}/reports/publish`, { method: 'POST' });

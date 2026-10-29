import { apiRequest, ApiError } from './client.js';
import { validScoreDetails } from '../lib/reportScore.js';

export async function getReportEvidence(teamId, userId, reportId) {
  const query = new URLSearchParams({ userId });
  const response = await apiRequest(`/api/teams/${teamId}/report/evidence?${query}`);
  if (!response || response.reportId !== reportId || response.teamId !== teamId || response.userId !== userId
    || !Number.isInteger(response.evaluatedMemberCount) || response.evaluatedMemberCount < 2
    || typeof response.totalScore !== 'number' || !Number.isFinite(response.totalScore) || response.totalScore < 0 || response.totalScore > 100
    || !Array.isArray(response.tasks) || !validScoreDetails(response.details, response.weights)) {
    throw new ApiError(502, { code: 'REPORT_EVIDENCE_MISMATCH', message: '선택한 리포트의 기여 근거를 확인하지 못했습니다. 리포트를 새로 불러와 주세요.' });
  }
  return response;
}

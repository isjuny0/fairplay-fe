import { apiRequest, ApiError } from './client.js';

import { validReportScore } from '../lib/reportScore.js';
export const getTeamReport = async (teamId) => {
  const report = await apiRequest(`/api/teams/${teamId}/report`);
  if (report != null && (report.teamId !== teamId || !validReportScore(report)))
    throw new ApiError(502, { code: 'REPORT_INVALID', message: '종합 평가 결과를 확인하지 못했습니다. 새로고침해 주세요.' });
  return report;
};
export const generateTeamReport = (teamId, weights) =>
  apiRequest(`/api/teams/${teamId}/report`, { method: 'POST', body: weights });
export const publishReport = (reportId) =>
  apiRequest(`/api/reports/${reportId}/publish`, { method: 'POST' });

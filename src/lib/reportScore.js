import { peerCriteria } from './peerCriteria.js';
import { validReportWeights } from './reportWeights.js';

const inRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export const reportScoreFields = ['taskWeightedScore', 'midWeightedScore', 'finalWeightedScore'];
export function validScoreDetails(details, weights) {
  if (!details || !validReportWeights(weights)) return false;
  const excludedWork = details.taskRatioPercent === null && details.taskScore === null && weights.taskPercent === 0 && details.taskWeightedScore === 0;
  return (excludedWork || (inRange(details.taskRatioPercent, 0, 100) && inRange(details.taskScore, 0, 100)))
    && reportScoreFields.every((key) => inRange(details[key], 0, 100))
    && ['mid', 'final'].every((round) => inRange(details[`${round}EvaluationAverage`], 1, 5)
      && inRange(details[`${round}EvaluationScore`], 20, 100)
      && Object.keys(peerCriteria).every((key) => inRange(details[`${round}CriteriaAverages`]?.[key], 1, 5)));
}
export function validReportScore(report) {
  return report && Number.isInteger(report.evaluatedMemberCount) && report.evaluatedMemberCount >= 2
    && validReportWeights(report.weights) && Array.isArray(report.members) && report.members.length > 0
    && report.members.length <= report.evaluatedMemberCount
    && new Set(report.members.map((member) => member.userId)).size === report.members.length
    && report.members.every((member) => typeof member.userId === 'string' && typeof member.name === 'string'
      && inRange(member.totalScore, 0, 100) && validScoreDetails(member.details, report.weights));
}

export const formatReportNumber = (value) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';

export const defaultReportWeights = Object.freeze({ taskPercent: 70, midPercent: 10, finalPercent: 20 });
export const reportWeightFields = [
  { key: 'taskPercent', label: '작업 점수' },
  { key: 'midPercent', label: '중간 동료 평가' },
  { key: 'finalPercent', label: '최종 동료 평가' },
];
export function validReportWeights(weights) {
  return weights != null && reportWeightFields.every(({ key }) => Number.isInteger(weights[key]) && weights[key] >= 0 && weights[key] <= 100) &&
    reportWeightFields.reduce((sum, { key }) => sum + weights[key], 0) === 100;
}
export function sameReportWeights(left, right) {
  return validReportWeights(left) && validReportWeights(right) && reportWeightFields.every(({ key }) => left[key] === right[key]);
}

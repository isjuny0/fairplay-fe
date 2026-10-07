export const roundLabels = { MID: '중간 평가', FINAL: '최종 평가' };
export const roundStatusLabels = {
  DRAFT: '일정 대기',
  OPEN: '작성 중',
  CLOSED: '마감',
};
export const formatPercent = (value, empty = '계산할 작업 없음') =>
  value == null ? empty : `${Number(value).toFixed(2)}%`;
export function completedWorkShare(member, members) {
  const totalCompletedWeight = members.reduce(
    (total, entry) => total + entry.approvedWorkWeight,
    0,
  );
  return totalCompletedWeight > 0
    ? (member.approvedWorkWeight / totalCompletedWeight) * 100
    : null;
}
export const isLowScore = (scores) =>
  Object.values(scores).some((score) => [1, 2].includes(Number(score)));
export function validatePeerResponse(scores, reason) {
  if (
    Object.keys(scores).length !== 4 ||
    ['taskExecution', 'responsibility', 'collaboration', 'communication'].some(
      (code) => !(code in scores),
    ) ||
    Object.values(scores).some(
      (score) =>
        !Number.isInteger(Number(score)) ||
        Number(score) < 1 ||
        Number(score) > 5,
    )
  )
    return '네 항목을 모두 1~5점으로 선택해 주세요.';
  if (
    isLowScore(scores) &&
    (reason.trim().length < 10 || reason.trim().length > 500)
  )
    return '1~2점이 포함되면 구체적인 행동 사유를 10~500자로 작성해 주세요.';
  if (reason.length > 500) return '평가 사유는 500자 이하로 작성해 주세요.';
  return null;
}

export function workSummary(teamId, userId, tasks, now = new Date()) {
  const sum = (items, own) =>
    items.reduce(
      (total, task) =>
        total +
        task.weight *
          (own
            ? (task.assignees.find((assignment) => assignment.userId === userId)
                ?.allocationPercent || 0) / 100
            : 1),
      0,
    );
  const done = tasks.filter((task) => task.status === 'DONE');
  const teamTotalWeight = sum(tasks, false),
    teamDoneWeight = sum(done, false);
  const myAssignedWeight = sum(tasks, true),
    myDoneWeight = sum(done, true);
  const rate = (part, total) =>
    total ? Math.round((part / total) * 10000) / 100 : null;
  const ownTasks = tasks.filter((task) =>
    task.assignees.some((assignment) => assignment.userId === userId),
  );
  return {
    teamId,
    asOf: now.toISOString(),
    teamTotalWeight,
    teamDoneWeight,
    myAssignedWeight,
    myDoneWeight,
    teamProgressRate: rate(teamDoneWeight, teamTotalWeight),
    myAssignedShare: rate(myAssignedWeight, teamTotalWeight),
    myCompletedContributionRate: rate(myDoneWeight, teamTotalWeight),
    myTaskCompletionRate: rate(myDoneWeight, myAssignedWeight),
    myPendingApprovalCount: ownTasks.filter(
      (task) => task.status === 'PENDING_APPROVAL',
    ).length,
    myOverdueTaskCount: ownTasks.filter(
      (task) => task.status !== 'DONE' && new Date(task.dueAt) < now,
    ).length,
  };
}

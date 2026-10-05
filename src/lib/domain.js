export const statusLabels = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  PENDING_APPROVAL: '승인 대기',
  DONE: '완료',
};
export const buildingLabels = {
  NOT_CONFIGURED: '기간 미설정',
  SCHEDULED: '시작 전',
  OPEN: '팀 빌딩 진행 중',
  CLOSED: '기간 종료',
  LOCKED: '팀 구성 고정',
};
export const categoryLabels = {
  PLANNING: '기획',
  POLICY: '정책',
  DESIGN: '설계',
  DEVELOPMENT: '개발',
  TEST: '테스트',
  OTHER: '기타',
};
export const completionBlockLabels = {
  NOT_ASSIGNEE: '현재 담당자만 완료를 요청할 수 있습니다.',
  INVALID_TASK_STATE: '진행 중인 작업만 완료를 요청할 수 있습니다.',
  REVIEWER_UNAVAILABLE: '적격한 승인자를 다시 지정해 주세요.',
  REVIEWER_IS_REQUESTER:
    '승인자로 지정된 본인은 완료 요청을 할 수 없습니다. 다른 담당자가 요청하거나 승인자를 변경해 주세요.',
  INSUFFICIENT_TEAM_MEMBERS: '승인된 팀원이 2명 이상 필요합니다.',
  CONTRIBUTION_DESCRIPTION_REQUIRED:
    '공동 담당자 모두의 수행 설명이 필요합니다.',
};
export const isApprovedMember = (team) =>
  team?.myMembershipStatus === 'APPROVED';
export const isTeamEditor = (team, userId) =>
  isApprovedMember(team) && [team.leaderId, team.deputyId].includes(userId);
export const isAssignee = (task, userId) =>
  task.assignees.some((assignment) => assignment.userId === userId);
export const isMutable = (task) =>
  ['TODO', 'IN_PROGRESS'].includes(task.status);
export const canEditTask = (task, team, userId) =>
  isMutable(task) &&
  isApprovedMember(team) &&
  (isAssignee(task, userId) || isTeamEditor(team, userId));
export const memberRole = (member) =>
  member.isLeader ? '리더' : member.isDeputy ? '부리더' : '팀원';
export const memberName = (members, userId) =>
  members.find((member) => member.userId === userId)?.name || '팀원';
export function reviewerCandidates(members, assignees) {
  const assignedIds = new Set(assignees.map((assignment) => assignment.userId));
  const allAssigned =
    members.length > 0 &&
    members.every((member) => assignedIds.has(member.userId));
  return members
    .filter((member) =>
      allAssigned
        ? member.isLeader || member.isDeputy
        : !assignedIds.has(member.userId),
    )
    .sort(
      (left, right) =>
        (left.isLeader ? 0 : left.isDeputy ? 1 : 2) -
        (right.isLeader ? 0 : right.isDeputy ? 1 : 2),
    );
}
export function deliverablePermissions(deliverable, task, team, userId) {
  if (!isApprovedMember(team))
    return { metadata: false, content: false, remove: false };
  if (deliverable.taskId != null) {
    const allowed = Boolean(
      task && isMutable(task) && isAssignee(task, userId),
    );
    return { metadata: allowed, content: allowed, remove: allowed };
  }
  const owner = deliverable.authorId === userId;
  return {
    metadata: owner || isTeamEditor(team, userId),
    content: owner,
    remove: owner,
  };
}
export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(value))
    : '미설정';
export const toDateInput = (value) =>
  value
    ? new Date(new Date(value).getTime() + 9 * 3600000)
        .toISOString()
        .slice(0, 16)
    : '';
export const fromDateInput = (value) => `${value}:00+09:00`;
export function errorMessage(error) {
  if (error.code === 'VERSION_CONFLICT')
    return `${error.message} 최신 정보를 다시 불러온 후 변경 내용을 확인해 주세요.`;
  return error.message || '요청을 처리하지 못했습니다.';
}

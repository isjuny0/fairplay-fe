import { apiTimeToEpoch } from './koreanTime.js';
export const statusLabels = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  REVISING: '수정 중',
  DONE: '완료',
};
export const expectedWorkloadOptions = [
  { weight: 1, label: '1시간 미만의 작업' },
  { weight: 2, label: '1시간 이상 ~ 3시간 미만의 작업' },
  { weight: 3, label: '3시간 이상 ~ 6시간 미만의 작업' },
  { weight: 5, label: '6시간 이상 ~ 12시간 미만의 작업' },
  { weight: 8, label: '12시간 이상의 작업' },
];
export const formatExpectedWorkload = (weight) =>
  expectedWorkloadOptions.find((option) => option.weight === weight)?.label ||
  '예상 작업량 확인 필요';
// 카드에서도 이상·미만 조건을 그대로 표시합니다.
export const formatBoardWorkload = (weight) =>
  formatExpectedWorkload(weight).replace('의 작업', '');
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
  DESIGN: '디자인·설계',
  DEVELOPMENT: '제작·구현',
  TEST: '검증',
  OTHER: '기타',
};
export const completionBlockLabels = {
  WORK_PERIOD_CLOSED:
    '최종 평가 마감 이후에는 작업을 변경하거나 완료 처리할 수 없습니다.',
  DELIVERABLE_REQUIRED: '완료 처리 전에 작업에 연결된 산출물이 필요합니다.',
  NOT_ASSIGNEE: '현재 담당자만 완료할 수 있습니다.',
  INVALID_TASK_STATE: '진행 중·수정 중인 작업만 완료할 수 있습니다.',
  INSUFFICIENT_TEAM_MEMBERS: '승인된 팀원이 2명 이상 필요합니다.',
  CONTRIBUTION_DESCRIPTION_REQUIRED:
    '담당자 모두의 수행 설명이 필요합니다.',
};
export const isApprovedMember = (team) =>
  team?.myMembershipStatus === 'APPROVED';
export const isTeamEditor = (team, userId) =>
  isApprovedMember(team) && team.leaderId === userId;
export const isAssignee = (task, userId) =>
  task.assignees.some((assignment) => assignment.userId === userId);
export const isMutable = (task) =>
  ['TODO', 'IN_PROGRESS', 'REVISING'].includes(task.status);
export const teamWorkBlocked = (team) =>
  Boolean(team.workFrozen || team.workStateUnknown);
export const canModifyTeamWork = (team) =>
  isApprovedMember(team) &&
  team.approvedMemberCount >= 2 &&
  !teamWorkBlocked(team);
export const canEditTask = (task, team, userId) =>
  isMutable(task) &&
  canModifyTeamWork(team) &&
  (isAssignee(task, userId) || isTeamEditor(team, userId));
export const memberRole = (member) =>
  ({ LEADER: '리더', MEMBER: '팀원' })[member.role];
export const memberName = (members, userId) =>
  members.find((member) => member.userId === userId)?.name || '팀원';
export function deliverablePermissions(deliverable, task, team, userId) {
  if (!isApprovedMember(team) || teamWorkBlocked(team))
    return { metadata: false, content: false, remove: false };
  if (deliverable.taskId != null) {
    const allowed = Boolean(
      task && isMutable(task) && isAssignee(task, userId),
    );
    return {
      metadata: allowed && canModifyTeamWork(team),
      content: allowed && canModifyTeamWork(team),
      remove: allowed,
    };
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
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(apiTimeToEpoch(value)))
    : '미설정';
export function teamBuildingCountdown(end, now = Date.now()) {
  if (!end) return null;
  const endTime = apiTimeToEpoch(end);
  const currentTime = typeof now === 'string' ? apiTimeToEpoch(now) : Number(now);
  if (!Number.isFinite(endTime) || !Number.isFinite(currentTime)) return null;
  if (currentTime >= endTime) return '마감';
  const day = 86400000;
  const koreaOffset = 9 * 3600000;
  const remaining = Math.floor((endTime + koreaOffset) / day)
    - Math.floor((currentTime + koreaOffset) / day);
  return remaining > 0 ? `D-${remaining}` : 'D-day';
}
export const toDateInput = (value) => value ? value.slice(0, 16) : '';
export const fromDateInput = (value) => `${value}:00`;
export function errorMessage(error) {
  if (error.code === 'REPORT_INPUT_INCOMPLETE')
    return '해당 팀의 중간·최종 평가 마감과 필수 제출을 확인해 주세요. 목록에 마감으로 표시되어도 서버의 마감 정리가 끝날 때까지 기다린 뒤 다시 시도해야 합니다.';
  if (error.code === 'REPORT_UNCALCULABLE')
    return '계산할 완료 작업 또는 평가 입력이 부족합니다. 최종 평가 마감 전 완료된 작업과 팀원의 담당 배분을 확인해 주세요.';
  if (error.code === 'REPORT_PUBLICATION_BLOCKED')
    return '해당 팀의 두 회차 마감과 필수 평가 제출을 확인한 뒤 공개해 주세요.';
  if (error.code === 'REPORT_WEIGHTS_LOCKED')
    return '스페이스 공통 반영 비율이 이미 확정되었습니다. 최신 비율을 확인한 뒤 다시 생성해 주세요.';
  if (error.code === 'TEAM_DELETION_REQUEST_INVALIDATED')
    return '팀 구성 또는 삭제 대상이 변경되었습니다. 리더가 새 삭제 요청을 만들어 다시 동의받아 주세요.';
  if (error.code === 'TEAM_DELETION_REQUEST_CANCELLED')
    return '삭제 요청이 취소되었습니다. 최신 현황을 확인해 주세요.';
  if (error.code === 'TEAM_DELETION_IN_PROGRESS')
    return '팀 삭제 동의 중에는 작업을 변경할 수 없습니다. 팀 설정에서 동의 현황을 확인해 주세요.';
  if (error.code === 'TEAM_LEAVE_HAS_DEPENDENCIES')
    return '담당 작업·공용 산출물이 남아 있어 탈퇴할 수 없습니다. 역할을 인계하고 자료를 정리해 주세요.';
  if (error.code === 'VERSION_CONFLICT')
    return `${error.message} 최신 정보를 다시 불러온 후 변경 내용을 확인해 주세요.`;
  return error.message || '요청을 처리하지 못했습니다.';
}

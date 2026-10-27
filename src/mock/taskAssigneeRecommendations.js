import { MockError } from './planned.js';
import { apiTimeToEpoch } from '../lib/koreanTime.js';

export function previewAssigneeRecommendations(
  context,
  state,
  entry,
  requestedCount,
) {
  if (!entry.members.some((member) => member.userId === context.user.id))
    throw new MockError('FORBIDDEN', '현재 팀원만 이용할 수 있습니다.', 403);
  const final = state.rounds.find((round) => round.type === 'FINAL');
  if (final && apiTimeToEpoch(final.closesAt) <= Date.now())
    throw new MockError(
      'TASK_WORK_CLOSED',
      '최종 평가 마감 이후에는 작업을 생성할 수 없습니다.',
      409,
    );
  if (state.deletion?.teamId === entry.team.id && state.deletion.workFrozen)
    throw new MockError(
      'TEAM_DELETION_IN_PROGRESS',
      '팀 삭제 동의가 진행 중입니다.',
      409,
    );
  if (entry.members.length < 2)
    throw new MockError(
      'INSUFFICIENT_TEAM_MEMBERS',
      '팀원이 2명 이상 필요합니다.',
      409,
    );
  const count = Number(requestedCount);
  if (
    !/^\d+$/.test(requestedCount || '') ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > Math.min(entry.members.length, 100)
  )
    throw new MockError(
      'INVALID_REQUEST',
      '자동 선택 인원을 확인해 주세요.',
      400,
    );
  const workload = new Map(entry.members.map((member) => [member.userId, 0]));
  for (const task of entry.tasks) {
    for (const assignment of task.assignees) {
      workload.set(
        assignment.userId,
        (workload.get(assignment.userId) || 0) +
          task.weight * assignment.allocationPercent,
      );
    }
  }
  const compareText = (left, right) =>
    left < right ? -1 : left > right ? 1 : 0;
  return [...entry.members]
    .sort(
      (left, right) =>
        workload.get(left.userId) - workload.get(right.userId) ||
        compareText(left.name, right.name) ||
        compareText(left.userId, right.userId),
    )
    .slice(0, count)
    .map((member, index) => ({
      userId: member.userId,
      allocationPercent:
        Math.floor(100 / count) + (index < 100 % count ? 1 : 0),
    }));
}

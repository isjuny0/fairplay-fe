import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import { MockError } from './planned.js';

export function invalidateReview(state, taskId) {
  if (state.reviews?.[taskId]) state.reviews[taskId].isCurrent = false;
}
export function previewAiReview(state, context, entry, task, method) {
  const assigned = task.assignees.some(
    (assignment) => assignment.userId === context.user.id,
  );
  const member = entry.members.some(
    (member) => member.userId === context.user.id,
  );
  if (!member || !assigned) throw new MockError('FORBIDDEN', '현재 담당자만 검토를 조회·실행할 수 있습니다.', 403);
  state.reviews ||= {};
  let review = state.reviews[task.id];
  if (
    review &&
    ['PENDING', 'PROCESSING'].includes(review.status) &&
    Date.now() >= review.completesAt
  ) {
    review.status = review.isCurrent ? 'COMPLETED' : 'FAILED';
    review.updatedAt = koreanDateTime();
    if (!review.isCurrent) review.failureCode = 'REVIEW_INPUT_CHANGED';
    else {
      review.summary =
        '요구사항과 제출 자료의 연결을 확인한 예시 피드백입니다.';
      review.strengths = [
        {
          message: '제출 결과의 설명이 작업 목적과 연결되어 있습니다.',
          references: [
            {
              deliverableId: review.deliverableId,
              quote: null,
              observation: '예시 자료에서 수행 결과의 설명을 확인합니다.',
              location: '제출 자료 본문',
            },
          ],
        },
      ];
      review.improvements = [
        {
          type: 'QUESTION',
          issue: '결과를 다시 확인할 수 있는 방법이 설명되어 있나요?',
          suggestion: '수행 조건과 확인 방법을 자료에 함께 정리해 보세요.',
          references: [],
        },
      ];
      review.limitations = [
        '미리보기 예시이며 실제 AI 모델을 호출하지 않습니다.',
      ];
    }
  }
  if (method === 'POST') {
    if (!['TODO', 'IN_PROGRESS', 'REVISING'].includes(task.status))
      throw new MockError(
        'TASK_LOCKED',
        '현재 작업 상태에서는 검토를 요청할 수 없습니다.',
      );
    if (entry.members.length < 2)
      throw new MockError(
        'INSUFFICIENT_TEAM_MEMBERS',
        '승인된 팀원이 2명 이상 필요합니다.',
      );
    if (state.deletion?.teamId === entry.team.id && state.deletion.workFrozen)
      throw new MockError(
        'TEAM_DELETION_IN_PROGRESS',
        '팀 삭제 동의 중입니다.',
      );
    const active = review && ['PENDING', 'PROCESSING'].includes(review.status);
    if (!(review?.isCurrent && (active || review.status === 'COMPLETED'))) {
      if (active)
        throw new MockError(
          'AI_REVIEW_IN_PROGRESS',
          '기존 검토가 종료된 후 다시 요청해 주세요.',
        );
      if (review && Date.now() - apiTimeToEpoch(review.createdAt) < 60000)
        throw new MockError(
          'AI_REVIEW_RATE_LIMITED',
          '새 검토는 작업당 1분에 한 번 요청할 수 있습니다.',
          429,
        );
      const deliverables = entry.deliverables.filter(
        (deliverable) => deliverable.taskId === task.id,
      );
      if (!deliverables.length)
        throw new MockError(
          'AI_REVIEW_INPUT_REQUIRED',
          '작업에 연결된 산출물이 필요합니다.',
          400,
        );
      const timestamp = koreanDateTime();
      review = {
        id: Date.now(),
        taskId: task.id,
        status: 'PENDING',
        isCurrent: true,
        summary: null,
        strengths: [],
        improvements: [],
        limitations: [],
        failureCode: null,
        failureDeliverableId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completesAt: Date.now() + 2000,
        deliverableId: deliverables[0].id,
      };
      state.reviews[task.id] = review;
    }
  }
  if (!review)
    throw new MockError('AI_REVIEW_NOT_FOUND', 'AI 검토 기록이 없습니다.', 404);
  const { completesAt, deliverableId, ...response } = review;
  return response;
}

import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import { MockError } from './planned.js';

function exampleFeedback(review) {
  const source = review.reviewedSources[0];
  return {
    summary: '점검 항목과 결과를 함께 기록하면 다른 팀원이 같은 화면에서 다시 확인할 수 있습니다.',
    findings: [
      {
        type: 'SUGGESTION', title: '점검 결과에 재현 방법을 함께 적어 보세요',
        description: '확인한 화면과 동작을 기록하면 팀원이 동일한 조건에서 결과를 검토할 수 있습니다.',
        action: '항목마다 화면 이름, 실행한 동작, 기대 결과와 실제 결과를 한 줄씩 남겨 보세요.',
        requirementQuote: null,
        references: [{ deliverableId: source.deliverableId, quote: null,
          observation: '재현 방법을 보완하는 예시입니다.', location: '예시 문서 본문' }],
      },
    ],
    strengths: [],
    limitations: ['화면 흐름을 보여주기 위한 가상 피드백입니다. 실제 자료를 분석하거나 AI 모델을 호출하지 않습니다.'],
  };
}

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
  // Reset old preview examples; their reviewed-source metadata was never saved.
  if (review && !Array.isArray(review.findings)) {
    delete state.reviews[task.id];
    review = null;
  }
  if (
    review &&
    ['PENDING', 'PROCESSING'].includes(review.status) &&
    Date.now() >= review.completesAt
  ) {
    review.status = review.isCurrent ? 'COMPLETED' : 'FAILED';
    review.updatedAt = koreanDateTime();
    if (!review.isCurrent) review.failureCode = 'REVIEW_INPUT_CHANGED';
    else {
      Object.assign(review, exampleFeedback(review));
      review.completedAt = review.updatedAt;
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
          '작업에 연결된 결과물이 필요합니다.',
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
        findings: [],
        reviewedSources: deliverables.map((item) => ({ deliverableId: item.id, title: item.title, type: item.type, version: item.version })),
        completedAt: null,
        limitations: [],
        failureCode: null,
        failureDeliverableId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completesAt: Date.now() + 2000,
      };
      state.reviews[task.id] = review;
    }
  }
  if (!review)
    throw new MockError('AI_REVIEW_NOT_FOUND', 'AI 검토 기록이 없습니다.', 404);
  const { completesAt, ...response } = review;
  return review.status === 'COMPLETED' ? response : {
    ...response,
    summary: null,
    strengths: [],
    findings: [],
    limitations: [],
    reviewedSources: [],
    completedAt: null,
  };
}

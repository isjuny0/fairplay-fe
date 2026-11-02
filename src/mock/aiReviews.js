import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import { MockError } from './planned.js';

function exampleFeedback(review) {
  const source = review.reviewedSources[0];
  return {
    summary: '주요 발견과 다음 단계 제안이 연결되어 있다고 가정한 예시입니다. 결론의 근거를 쉽게 찾을 수 있도록 정리하고, 우선 반영할 개선안을 팀과 확인하는 흐름을 살펴보세요.',
    findings: [
      {
        type: 'SUGGESTION', title: '주요 발견마다 근거를 연결해 보세요',
        description: '발견과 근거가 함께 있으면 팀원이 결론을 이해하고 다음 작업에 활용하기 쉽습니다.',
        action: '각 주요 발견 아래에 이를 뒷받침하는 응답이나 관찰 내용을 연결해 보세요. 작업 범위에 맞게 선택해서 반영할 수 있습니다.',
        requirementQuote: null,
        references: [{ deliverableId: source.deliverableId, quote: null,
          observation: '문서에 주요 발견과 다음 단계 제안이 정리되어 있다고 가정한 예시입니다.', location: '예시 문서 본문' }],
      },
      {
        type: 'QUESTION', title: '다음 단계에서 먼저 반영할 개선안은 무엇인가요?',
        description: '개선안의 우선순위를 알면 다음 작업으로 연결할 내용을 더 구체적으로 검토할 수 있습니다.',
        action: '팀이 먼저 진행하기로 한 개선안과 선택 이유를 확인해 주세요.',
        requirementQuote: null, references: [],
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

import { validReportScore } from '../lib/reportScore.js';
import { getMockState, resetMockState, saveMockState } from './planned.js';
import { previewContext, previewRole, setPreviewRole } from './preview.js';
import { apiTimeToEpoch, koreanDateTime } from '../lib/koreanTime.js';
import { workSummary } from '../lib/evaluation.js';
import { sameReportWeights, validReportWeights } from '../lib/reportWeights.js';

export const guideStorageKey = 'fairplay:preview-guide:v1';
export const guideScopeKey = 'fairplay:preview-guide-scope';
export const guideTaskId = 109;
export const guideHome = '/preview/spaces/1/teams/1';
export const guideTask = `${guideHome}/tasks/${guideTaskId}`;
export const materialsGuidePath = `${guideHome}/materials-search`;
export const managerGuidePath = '/preview/spaces/1/dashboard';
export const managerGuideMemberId = '00000000-0000-4000-8000-000000000001';
export const managerGuideMemberPath = `/preview/spaces/1/manager/teams/1/members/${managerGuideMemberId}`;
export const managerGuideTaskId = 101;
export const managerGuideDeliverableId = 1002;
export const evaluationGuidePath = '/preview/spaces/1/rounds';
export const reportManagementGuidePath = '/preview/spaces/1/reports';
export function evaluationGuideSchedule(now = Date.now()) {
  return { type: 'MID', opensAt: koreanDateTime(now - 5 * 60000).slice(0, 16), closesAt: koreanDateTime(now + 7 * 86400000).slice(0, 16) };
}
export const contributionGuidePath = `${guideHome}/reports`;
export const guidePeerRoundId = 12;
export const peerGuidePath = `${guideHome}/peer-evaluations?roundId=${guidePeerRoundId}`;
export const guideExamples = {
  peerScores: { taskExecution: 4, responsibility: 4, collaboration: 3, communication: 4 },
  peerReason: '담당한 작업의 진행 상황을 공유하고 필요한 자료를 정리해 팀의 작업을 도왔습니다.',
  question: '우리 프로젝트의 목표와 범위는 무엇인가요?',
  contributionDescription: '사용자 조사 응답을 주제별로 분류하고, 팀이 우선 해결할 문제와 다음 단계 제안을 문서로 정리했습니다.',
  deliverable: {
    title: '사용자 조사 결과 요약',
    description: '조사에서 확인한 핵심 발견과 다음 단계 제안을 정리한 예시 문서입니다.',
    category: 'PLANNING',
    type: 'TEXT',
    text: '## 핵심 발견\n\n- 팀원은 작업의 담당자와 진행 상황을 한눈에 확인하고 싶어 합니다.\n- 수행한 내용과 결과물이 작업에 함께 연결되면 진행 상황을 이해하기 쉽습니다.\n\n## 다음 단계\n\n작업별 수행 설명과 산출물을 남기고, 완료 후 팀 진행률에 반영되는 흐름을 확인합니다.',
  },
};
export const guideSteps = [
  { id: 'team-progress', title: '우리 팀의 진행률을 확인하세요', description: '작업을 완료하면 예상 작업량을 반영한 팀 진행률이 달라집니다. 현재 값을 확인한 뒤, 강조된 ‘작업 보드 보기’ 버튼을 직접 눌러 주세요.', path: guideHome, target: '[data-guide="team-progress"]', actionTarget: '[data-guide="open-tasks"]', action: '강조 위치 보기' },
  { id: 'task', title: '예시 작업을 열어 보세요', description: '‘예시 작업: 조사 결과 정리’는 내가 단독으로 담당하는 작업입니다. 강조된 작업 제목을 직접 눌러 내용을 확인하세요.', path: `${guideHome}/tasks?view=list&mine=1`, actionTarget: '[data-guide-task-id="109"]', action: '강조 위치 보기' },
  { id: 'deliverable', title: '작업 결과를 문서로 남기세요', description: '강조된 ‘산출물 등록’ 버튼을 눌러 주세요. 자동 입력된 문서 내용을 확인한 뒤 등록 창의 ‘저장’을 직접 누르면 작업에 연결됩니다.', path: guideTask, section: 'task-deliverables-section', target: '#task-deliverables-section', actionTarget: '[data-guide="open-deliverable"]', dialogTitle: '산출물 등록', dialogCalloutContainer: '.deliverable-editor-scroll', dialogDescription: '예시 문서의 제목과 본문이 자동 입력되었습니다. 내용을 확인하거나 수정한 뒤 하단의 ‘저장’을 눌러 작업에 연결하세요.', dialogTarget: 'input[name="title"], textarea[name="text"]', dialogActionTarget: 'button[type="submit"]', action: '강조 위치 보기' },
  { id: 'ai-feedback', title: '산출물의 AI피드백을 확인하세요', description: '‘AI 검토 요청’을 눌러 예시 피드백을 확인하세요. 실제 AI를 호출하지 않습니다. AI 검토는 일반 작업 완료의 필수 조건은 아닙니다.', readyDescription: '예시 피드백의 요약·잘된 점·보완할 내용을 확인한 뒤, 결과 아래의 ‘피드백 확인 완료’를 직접 눌러 주세요.', path: guideTask, section: 'task-ai-review-section', target: '.ai-review-panel', actionTarget: '[data-guide="request-ai-review"]', readyTarget: '.ai-review-result', readyActionTarget: '[data-guide="confirm-ai-feedback"]', action: '강조 위치 보기' },
  { id: 'contribution', title: '내가 수행한 내용을 기록하세요', description: '예시 수행 설명을 자동으로 채웠습니다. 내용을 확인한 뒤 화면의 ‘수행 설명 저장’ 버튼을 직접 눌러 주세요. 직접 수정해도 됩니다.', path: guideTask, section: 'task-contributions-section', target: '#own-contribution-description', calloutTarget: '#own-contribution-description', calloutAvoidClosest: 'form', calloutPlacement: 'flow', actionTarget: '[data-guide="save-contribution"]', action: '강조 위치 보기' },
  { id: 'complete', title: '완료 조건을 확인하고 완료하세요', description: '완료하려면 수행 설명과 연결 산출물이 필요합니다. 준비 항목을 확인하고 완료 처리를 확정하세요. 담당 배분은 이 작업 안의 분담이며 최종 종합점수와 다릅니다.', path: guideTask, section: 'task-description-section', target: '[aria-label="완료 준비 상태"]', actionTarget: '[data-guide="complete-task"]', dialogTitle: '작업 완료', dialogDescription: '완료하면 팀 진행률에 반영됩니다. 안내를 확인하고 ‘완료 처리’를 직접 눌러 주세요.', dialogActionTarget: '.modal-actions .primary-button', action: '강조 위치 보기' },
  { id: 'result', title: '진행률의 변화를 확인하세요', description: '완료한 작업만 팀 진행률에 포함됩니다. 팀 홈에서 처음 진행률과 현재 값을 비교해 보세요.', path: guideHome, target: '[data-guide="team-progress"]', calloutTarget: '[data-guide="team-progress"] [role="progressbar"]', action: '가이드 마치기' },
];
export const materialsGuideSteps = [
  { id: 'materials-overview', title: '검색할 팀 자료를 확인하세요', description: '팀 자료 목록에서 제목과 검색 가능 상태를 확인한 뒤 ‘자료 확인 완료’를 눌러 주세요. 좁은 화면에서는 ‘팀 자료’를 눌러 목록을 열 수 있습니다.', path: materialsGuidePath, target: '[data-materials-list]', actionTarget: '[data-guide="confirm-materials-overview"], [data-guide="open-materials"]', action: '강조 위치 보기' },
  { id: 'materials-question', title: '팀 자료에 질문해 보세요', description: '예시 질문이 자동 입력되었습니다. 내용을 확인하거나 수정한 뒤 ‘질문 보내기’를 직접 눌러 주세요. 예시 답변을 사용하며 실제 AI 모델은 호출하지 않습니다.', path: materialsGuidePath, target: '#rag-question', actionTarget: '[data-guide="send-material-question"]', action: '강조 위치 보기' },
  { id: 'materials-answer', title: '답변과 근거 자료를 함께 확인하세요', description: '답변 아래의 자료 제목·인용문·원문 위치를 확인하세요. 확인한 뒤 ‘답변 확인 완료’를 누르면 원문을 살펴보는 단계로 넘어갑니다.', path: materialsGuidePath, target: '.rag-answer', actionTarget: '[data-guide="confirm-material-answer"]', action: '강조 위치 보기' },
  { id: 'materials-source', title: '근거 원문에서 직접 확인하세요', description: '답변의 ‘원문 확인’을 눌러 인용 위치와 전체 원문을 비교하세요. 원문을 읽은 뒤 ‘원문 확인 완료’를 누르면 가이드가 끝납니다.', path: materialsGuidePath, target: '.rag-original', calloutTarget: '[data-guide="confirm-material-source"]', actionTarget: '[data-guide="confirm-material-source"], [data-guide="open-material-citation"]', action: '강조 위치 보기' },
];
export const peerGuideSteps = [
  { id: 'peer-overview', title: '평가 회차와 대상을 확인하세요', description: '진행 중인 최종 평가와 같은 팀의 평가 대상을 확인하세요. 본인은 평가 대상에서 제외됩니다. 확인한 뒤 ‘평가 대상 확인 완료’를 눌러 주세요.', path: peerGuidePath, target: '.peer-round-overview, .peer-target-picker', calloutTarget: '.peer-target-picker', calloutAvoidClosest: '.peer-response-sidebar', calloutPlacement: 'vertical', actionTarget: '[data-guide="confirm-peer-overview"]', action: '강조 위치 보기' },
  { id: 'peer-responses', title: '팀원별 평가를 저장하세요', description: '예시 점수와 사유가 자동 입력되었습니다. 확인하거나 수정한 뒤 현재 팀원의 ‘평가 저장’을 직접 눌러 주세요. 저장 후 ‘다음 팀원’으로 이동해 나머지 대상도 저장하세요. 저장만으로는 최종 제출되지 않습니다.', path: peerGuidePath, target: '.peer-target.is-active .peer-score-grid', calloutTarget: '.peer-target.is-active .peer-card > .page-heading', calloutPlacement: 'flow', actionTarget: '[data-guide="save-peer-response"], [data-guide="next-peer-target"]', action: '강조 위치 보기' },
  { id: 'peer-submit', title: '저장한 평가를 최종 제출하세요', description: '모든 대상의 응답을 저장했습니다. ‘최종 제출’을 누르고 확인 창에서 ‘제출 확정’을 직접 눌러 주세요. 제출한 응답은 수정할 수 없습니다.', path: peerGuidePath, target: '.peer-submit-bar', actionTarget: '[data-guide="submit-peer-evaluation"]', dialogTitle: '동료 평가 최종 제출', dialogDescription: '제출 후에는 응답을 수정할 수 없습니다. 내용을 확인하고 ‘제출 확정’을 눌러 주세요.', dialogActionTarget: '[data-guide="confirm-peer-submit"]', action: '강조 위치 보기' },
  { id: 'peer-result', title: '제출 완료 상태를 확인하세요', description: '최종 제출 완료 표시와 수정할 수 없게 된 응답을 확인하세요. ‘제출 결과 확인 완료’를 누르면 가이드를 마칩니다. 실제 계정의 평가에는 반영되지 않습니다.', path: peerGuidePath, target: '.evaluation-progress', actionTarget: '[data-guide="confirm-peer-result"]', action: '강조 위치 보기' },
];
export function peerResponseGuideStep(step, state) {
  if (step.id !== 'peer-responses' || !state?.name) return step;
  if (state.saved) return { ...step, title: `${state.name}님의 평가를 저장했습니다`,
    description: '‘다음 팀원’을 눌러 나머지 팀원의 평가도 저장하세요. 저장한 점수나 사유를 바꾸면 다시 저장해야 합니다.',
    target: '.peer-target-picker', actionTarget: '[data-guide="next-peer-target"]' };
  return { ...step, title: `${state.name}님의 평가를 확인하고 저장하세요`,
    description: `예시 점수와 사유가 입력되어 있습니다. 내용을 확인하거나 수정한 뒤 ‘${state.name} 평가 저장’을 누르세요.`,
    actionTarget: '[data-guide="save-peer-response"]' };
}
export const reportGuideTaskId = 106;
export const reportGuideMaterialId = 1005;
export const contributionGuideSteps = [
  { id: 'report-overview', title: '본인의 종합점수를 확인하세요', description: '종합점수는 개인별 100점 만점입니다. 다른 팀원과 나눠 갖는 비율이 아닙니다. 점수를 확인한 뒤 ‘종합점수 확인 완료’를 누르세요.', path: contributionGuidePath, target: '.report-personal-summary .report-score-total', calloutAvoidClosest: '.report-personal-summary', calloutPlacement: 'flow', actionTarget: '[data-guide="confirm-report-overview"]', action: '강조 위치 보기' },
  { id: 'report-components', title: '원점수가 반영되는 과정을 확인하세요', description: '원점수 → 평가 비중 → 반영 점수 순서로 읽어 보세요. 완료 작업량 비율은 작업 점수와 다르며, 작업 점수 옆 도움말에서 환산 방식을 확인할 수 있습니다. ‘반영 점수 확인 완료’를 누르면 동료 평가로 이동합니다.', path: contributionGuidePath, target: '.report-score-components > dl', calloutTarget: '.report-score-components', calloutContainer: '.report-score-components', calloutPlacement: 'flow', actionTarget: '[data-guide="confirm-report-components"]', action: '강조 위치 보기' },
  { id: 'report-peer-results', title: '최종 평가 결과로 전환해 보세요', description: '지금은 중간 평가에서 받은 네 항목의 평균입니다. ‘최종 평가’를 직접 눌러 다른 회차의 결과를 확인하세요. 각 항목은 5점 만점이며 반영 점수와는 다른 값입니다.', path: contributionGuidePath, target: '.composite-criteria .peer-criteria-scores', calloutTarget: '.composite-criteria', calloutContainer: '.composite-criteria', calloutPlacement: 'flow', actionTarget: '[data-guide="report-final-criteria"]', action: '강조 위치 보기' },
  { id: 'report-tasks', title: '점수에 반영된 완료 작업을 펼쳐 보세요', description: '‘조사 결과 요약’을 직접 눌러 담당 비율과 수행 설명을 확인하세요. 이어서 연결된 문서를 열어 실제 결과물까지 살펴봅니다.', path: contributionGuidePath, target: `[data-guide-report-task="${reportGuideTaskId}"]`, calloutTarget: '.contribution-evidence-list', calloutContainer: '.contribution-evidence-list', calloutPlacement: 'flow', actionTarget: `[data-guide-report-task="${reportGuideTaskId}"]`, action: '강조 위치 보기' },
];
export function contributionGuideStep(step, { criteriaRound, openedTaskId, source } = {}) {
  if (step.id === 'report-peer-results' && criteriaRound === 'final') return { ...step,
    title: '최종 평가의 항목별 평점을 확인하세요', description: '최종 평가 결과를 열었습니다. 작업 수행·책임감·적극성·의사소통의 평점을 확인한 뒤 ‘동료 평가 확인 완료’를 누르세요.',
    actionTarget: '[data-guide="confirm-report-peer-results"]' };
  if (step.id !== 'report-tasks' || openedTaskId !== reportGuideTaskId) return step;
  if (source?.taskId === reportGuideTaskId && source.materialId === reportGuideMaterialId) {
    if (source.ready) return { ...step, title: '수행 설명과 연결 문서를 함께 확인하세요',
      description: '연결된 문서를 열었습니다. 수행 설명과 실제 결과물을 비교하세요. 작업량과 담당 비율은 리포트 집계 기준이며, 펼친 문서는 현재 자료입니다. ‘리포트 확인 마치기’를 누르면 가이드를 마칩니다.',
      target: '[data-guide="report-material-preview"]', actionTarget: '[data-guide="confirm-report-tasks"]' };
    return { ...step, title: source.loading ? '연결 문서를 불러오고 있습니다' : '연결 문서의 조회 상태를 확인하세요',
      description: source.loading ? '본문을 불러온 뒤 수행 설명과 비교할 수 있습니다. 잠시 기다려 주세요.' : '문서를 불러오지 못했습니다. 문서 영역에서 다시 불러온 뒤 확인을 마쳐 주세요.',
      target: '[data-guide="report-material-preview"]', actionTarget: null };
  }
  return { ...step, title: '연결된 문서를 직접 열어 보세요',
    description: '작업의 수행 설명을 확인한 뒤 ‘조사 결과 요약 문서’를 누르세요. 점수에 반영된 작업과 실제 결과물을 함께 확인합니다.',
    target: `[data-guide-report-task-body="${reportGuideTaskId}"]`, actionTarget: `[data-guide-report-material="${reportGuideMaterialId}"]` };
}
export function contributionTaskGuideReady(report, userId, openedTaskId, source) {
  return contributionGuideReady(report, userId) && openedTaskId === reportGuideTaskId
    && source?.reportId === report.id && source.userId === userId && source.taskId === reportGuideTaskId
    && source.materialId === reportGuideMaterialId && source.ready === true && !source.loading && !source.error;
}
export function contributionGuideReady(report, userId) {
  return Boolean(report?.status === 'PUBLISHED' && report.teamId === 1 && validReportScore(report)
    && report.members.length === 1 && report.members[0].userId === userId);

}
export const managerGuideSteps = [
  { id: 'manager-select-team', title: '진행 상황을 확인할 팀을 선택하세요', description: '팀 관리 목록에서 삼위일체의 진행률과 작업 현황을 살펴보고, 강조된 팀 이름을 직접 눌러 주세요.', path: managerGuidePath, target: '[data-guide-manager-team-row="1"]', calloutAvoidClosest: '[data-guide-manager-team-row]', calloutPlacement: 'vertical', actionTarget: '[data-guide-manager-team="1"]', action: '강조 위치 보기' },
  { id: 'manager-overview', title: '팀의 진행 상황을 살펴보세요', description: '팀 진행률·작업 현황과 마감 지연·장기 정체를 확인하세요. 진행률과 완료 작업 비중은 최종 종합점수와 다른 지표입니다. 팀원 수행 현황에서 ‘김하늘 수행 상세’를 직접 눌러 주세요.', path: `${managerGuidePath}?teamId=1`, target: '.dashboard-work-overview, .dashboard-team-notices', actionTarget: `[data-guide-manager-member="${managerGuideMemberId}"]`, action: '강조 위치 보기' },
  { id: 'manager-member', title: '팀원의 수행 기록을 확인하세요', description: '작업 기록에서 ‘사용자 인터뷰 계획’의 상태·담당 배분·수행 설명을 확인하세요. 확인한 뒤 ‘수행 기록 확인 완료’를 누르면 연결 산출물을 살펴봅니다. 관리자는 수행 내용을 수정하지 않습니다.', path: `${managerGuideMemberPath}?taskId=${managerGuideTaskId}`, target: '.member-task-record', actionTarget: `[data-guide-manager-task="${managerGuideTaskId}"], [data-guide="confirm-manager-member"]`, action: '강조 위치 보기' },
  { id: 'manager-material', title: '연결된 산출물을 직접 펼쳐 보세요', description: '‘인터뷰 계획과 질문 목록’을 눌러 원문을 확인하세요. 수행 설명과 실제 결과물을 함께 살펴본 뒤 ‘산출물 확인 완료’를 누르면 가이드를 마칩니다.', path: `${managerGuideMemberPath}?taskId=${managerGuideTaskId}`, target: '[data-guide="manager-material-content"]', actionTarget: `[data-guide-manager-task="${managerGuideTaskId}"], details:not([open]) > [data-guide-manager-deliverable="${managerGuideDeliverableId}"], [data-guide="confirm-manager-material"]`, action: '강조 위치 보기' },
];
export function managerGuideReady(stepId, state, source) {
  if (stepId === 'manager-select-team') return Boolean(state?.kind === 'team' && state.team?.teamId === 1
    && typeof state.team.completionRate === 'number' && Number.isFinite(state.team.completionRate)
    && state.team.members?.some((member) => member.userId === managerGuideMemberId));
  const memberReady = state?.kind === 'member' && state.teamId === 1 && state.userId === managerGuideMemberId
    && state.task?.taskId === managerGuideTaskId && typeof state.task.contributionDescription === 'string'
    && state.task.deliverableSummary?.some((item) => item.id === managerGuideDeliverableId && item.type === 'TEXT');
  if (stepId === 'manager-overview' || stepId === 'manager-member') return Boolean(memberReady);
  if (stepId === 'manager-material') return Boolean(memberReady && source?.ready && source.teamId === 1
    && source.taskId === managerGuideTaskId && source.deliverableId === managerGuideDeliverableId
    && state.task.deliverableSummary.some((item) => item.id === source.deliverableId && item.version === source.version));
  return false;
}
export const evaluationGuideSteps = [
  { id: 'evaluation-overview', title: '중간·최종 평가를 확인하세요', description: '중간 평가와 최종 평가를 각각 설정할 수 있습니다. 이 가이드에서는 중간 평가를 시작합니다. 두 평가의 일정과 상태를 확인한 뒤 ‘평가 회차 확인 완료’를 눌러 주세요.', path: evaluationGuidePath, target: '[data-guide="evaluation-rounds"]', actionTarget: '[data-guide="confirm-evaluation-overview"]', action: '강조 위치 보기' },
  { id: 'evaluation-schedule', title: '중간 평가 일정을 저장하세요', description: '중간 평가의 ‘일정 설정’을 눌러 주세요. 지금 시작할 수 있는 예시 일정이 자동 입력됩니다. 확인하거나 수정한 뒤 ‘저장’을 직접 누르세요. 저장 후 예시 일정에 따라 자동으로 평가가 시작됩니다.', path: evaluationGuidePath, target: '[data-guide-round="MID"]', actionTarget: '[data-guide="schedule-mid-evaluation"]', dialogTitle: '중간 평가 일정 설정', dialogDescription: '예시 시작·마감 시각을 확인하거나 수정한 뒤 ‘저장’을 눌러 주세요. 예시 시작 시각이 되어 자동으로 평가가 열립니다. 중간 평가 시작 시 팀 구성과 평가 참여자가 고정됩니다.', dialogTarget: '.date-time-input', dialogActionTarget: 'button[type="submit"]', action: '강조 위치 보기' },
  { id: 'evaluation-result', title: '평가 시작과 팀별 제출 현황을 확인하세요', description: '중간 평가가 ‘평가 진행 중’으로 바뀌고 팀별 제출 현황이 표시됩니다. 화면에 표시된 팀별 제출·미제출 인원을 확인한 뒤 ‘시작 결과 확인 완료’를 누르세요. 평가는 마감 시각에 자동 종료됩니다.', path: evaluationGuidePath, target: '[data-guide-round="MID"]', calloutTarget: '[data-guide-round="MID"]', calloutAvoidClosest: '[data-guide-round="MID"]', calloutPlacement: 'flow', actionTarget: '[data-guide="confirm-evaluation-result"]', action: '강조 위치 보기' },
];
export function evaluationGuideReady(stepId, state) {
  if (!state || state.space?.id !== 1 || state.dashboard?.spaceId !== 1 || !Array.isArray(state.rounds)) return false;
  const teams = state.dashboard.teams;
  if (!teams?.length || teams.some((team) => !Number.isInteger(team.approvedMemberCount) || team.approvedMemberCount < 2)) return false;
  const round = state.rounds.find((item) => item.type === 'MID' && item.spaceId === 1);
  if (stepId === 'evaluation-overview') return state.rounds.length === 0;
  if (!round || !Number.isFinite(apiTimeToEpoch(round.opensAt)) || !Number.isFinite(apiTimeToEpoch(round.closesAt))
    || apiTimeToEpoch(round.opensAt) >= apiTimeToEpoch(round.closesAt)) return false;
  if (stepId === 'evaluation-schedule') return ['DRAFT', 'OPEN'].includes(round.status);
  const submissions = state.dashboard.missingPeerSubmissions?.find((item) => item.roundId === round.id && item.status === 'OPEN');
  const participantCount = teams.reduce((sum, team) => sum + team.approvedMemberCount, 0);
  const opened = round.status === 'OPEN' && round.participantCount === participantCount && participantCount > 0
    && Boolean(state.space.membershipLockedAt) && submissions?.teams?.length === teams.length
    && submissions.teams.every((team) => teams.some((entry) => entry.teamId === team.teamId && entry.approvedMemberCount === team.requiredCount)
      && Number.isInteger(team.submittedCount) && team.submittedCount >= 0 && team.submittedCount <= team.requiredCount
      && team.missingCount === team.requiredCount - team.submittedCount);
  if (stepId === 'evaluation-result') return Boolean(opened && state.viewedRoundId === round.id);
  return false;
}
export const reportManagementGuideSteps = [
  { id: 'management-report-weights', title: '모든 팀에 적용할 평가 비중을 확인하세요', description: '중간·최종 평가가 마감되고 전원 제출한 예시입니다. 세 비중의 합계를 100%로 맞춘 뒤 ‘생성 조건 확인 완료’를 누르세요. 첫 생성 성공 후에는 비중을 바꿀 수 없습니다.', path: reportManagementGuidePath, target: '.report-weight-fields', calloutTarget: '[data-guide="report-weight-content"]', calloutContainer: '[data-guide="report-weight-content"]', calloutPlacement: 'flow', actionTarget: '[data-guide="confirm-management-report-weights"]', action: '강조 위치 보기' },
  { id: 'management-report-generate', title: '전체 팀의 리포트를 미공개로 생성하세요', description: '‘전체 리포트 생성’을 직접 누르세요. 모든 팀의 종합점수를 함께 생성하며, 아직 팀원에게 공개되지 않습니다. 생성이 끝나면 팀별 결과를 검토합니다.', path: reportManagementGuidePath, target: '[data-guide="generate-all-reports"]', calloutTarget: '.report-batch-generation', calloutContainer: '.report-batch-generation', calloutPlacement: 'flow', actionTarget: '[data-guide="generate-all-reports"]', action: '강조 위치 보기' },
  { id: 'management-report-review', title: '팀원별 종합점수와 반영 점수를 검토하세요', description: '삼위일체의 ‘리포트 확인’을 눌러 팀원별 종합점수와 세부 평가를 확인합니다. 이 가이드에서는 김하늘님의 결과를 검토합니다.', path: `${reportManagementGuidePath}?teamId=1`, section: 'report-guide-member', target: '.report-team-result', calloutContainer: '.report-team-result', calloutPlacement: 'flow', actionTarget: '[data-guide="choose-report-guide-team"]', action: '강조 위치 보기' },
  { id: 'management-report-evidence', title: '점수에 반영된 작업을 펼쳐 보세요', description: '‘사용자 인터뷰 계획’을 직접 눌러 수행 설명과 담당 비율을 확인합니다. 이어서 연결된 문서를 열어 실제 결과물까지 살펴봅니다.', path: `${reportManagementGuidePath}?teamId=1`, section: 'report-guide-evidence', target: `[data-guide-report-task="${managerGuideTaskId}"]`, calloutTarget: '.contribution-evidence-list', calloutContainer: '.contribution-evidence-list', calloutPlacement: 'flow', actionTarget: `[data-guide-report-task="${managerGuideTaskId}"]`, action: '강조 위치 보기' },
  { id: 'management-report-publish', title: '전체 팀에 공개할 준비가 됐는지 확인하세요', description: '예시 팀의 검토를 마쳤습니다. 실제 운영에서는 다른 팀도 검토한 뒤 ‘전체 리포트 공개’를 누르세요. 확인 창에서 공개 범위를 확인하고 최종 확정합니다.', path: reportManagementGuidePath, target: '[data-guide="space-report-publication"]', calloutTarget: '.report-batch-generation', calloutContainer: '.report-batch-generation', calloutPlacement: 'flow', actionTarget: '[data-guide="publish-all-reports"]', dialogTitle: '전체 리포트 공개', dialogDescription: '전체 팀에 함께 공개합니다. 각 팀원은 본인의 종합점수·평가 결과·작업 근거만 볼 수 있습니다. 공개 후 되돌릴 수 없으므로 확인한 뒤 ‘전체 공개 확정’을 누르세요.', dialogTarget: '[data-guide="report-publication-scope"]', dialogActionTarget: '[data-guide="confirm-publish-all-reports"]', action: '강조 위치 보기' },
  { id: 'management-report-result', title: '모든 팀의 공개 완료 상태를 확인하세요', description: '팀별 리포트 상태가 모두 ‘공개 완료’로 바뀌었습니다. ‘공개 결과 확인 완료’를 누르면 가이드를 마칩니다. 실제 계정의 리포트에는 반영되지 않습니다.', path: reportManagementGuidePath, target: '.report-management-table .report-list-status', calloutTarget: '.report-results-section', calloutContainer: '.report-results-section', calloutPlacement: 'flow', actionTarget: '[data-guide="confirm-management-report-result"]', action: '강조 위치 보기' },
];
export function reportManagementGuideReady(stepId, batch, result, review, evidence) {
  if (!batch || batch.spaceId !== 1 || !validReportWeights(batch.weights)) return false;
  const teams = batch.teams;
  if (!teams?.length || batch.totalTeamCount !== teams.length) return false;
  if (stepId === 'management-report-weights') return batch.canGenerate && teams.every((team) => team.reportId == null)
    && !batch.weightsConfirmed && batch.generationBlockReasons.length === 0;
  const allGenerated = teams.every((team) => team.reportId != null) && batch.weightsConfirmed && batch.generationBlockReasons.length === 0;
  if (stepId === 'management-report-generate') return allGenerated;
  if (stepId === 'management-report-publish' || stepId === 'management-report-result')
    return allGenerated && batch.publishedTeamCount === teams.length && teams.every((team) => team.reportStatus === 'PUBLISHED' && Number.isFinite(apiTimeToEpoch(team.publishedAt)));

  const report = result?.report;
  if (!allGenerated || result?.teamId !== 1 || report?.teamId !== 1 || !sameReportWeights(report.weights, batch.weights)
    || report.id !== teams.find((team) => team.teamId === 1)?.reportId || !validReportScore(report)
    || report.members.length !== report.evaluatedMemberCount) return false;
  const memberReviewed = report.status === 'UNPUBLISHED' && review?.reportId === report.id
    && review.memberId === managerGuideMemberId && review.open === true
    && report.members.some((member) => member.userId === review.memberId && member.details);
  if (stepId === 'management-report-review') return memberReviewed;
  if (stepId === 'management-report-evidence') return memberReviewed && evidence?.openedTaskId === managerGuideTaskId
    && evidence.source?.reportId === report.id && evidence.source.userId === managerGuideMemberId
    && evidence.source.taskId === managerGuideTaskId && evidence.source.materialId === managerGuideDeliverableId
    && evidence.source.ready === true && !evidence.source.loading && !evidence.source.error;
  return false;
}
export function getGuideSteps(scenarioId = 'task-completion') {
  return { 'task-completion': guideSteps, 'materials-search': materialsGuideSteps, 'peer-evaluation': peerGuideSteps, 'contribution-report': contributionGuideSteps, 'team-management': managerGuideSteps, 'evaluation-management': evaluationGuideSteps, 'report-management': reportManagementGuideSteps }[scenarioId] || guideSteps;
}

// Presentation follows the selected record and loaded source; it never advances
// a step or relaxes the separate completion checks.
export function managerGuideStep(step, { member, source, reportResult, reportReview, reportEvidence, reportReviewReady = false } = {}) {
  const placement = {
    'manager-overview': { calloutTarget: '.dashboard-work-overview', calloutAvoidClosest: '.dashboard-work-overview', calloutPlacement: 'flow' },
    'manager-member': { calloutAvoidClosest: '.member-task-record', calloutPlacement: 'vertical' },
    'manager-material': { calloutAvoidClosest: '.member-task-materials', calloutPlacement: 'vertical' },
    'evaluation-overview': { calloutTarget: '[data-guide="evaluation-rounds"]', calloutAvoidClosest: '[data-guide="evaluation-rounds"]', calloutPlacement: 'flow' },
    'evaluation-schedule': { calloutTarget: '[data-guide-round="MID"]', calloutAvoidClosest: '[data-guide-round="MID"]', calloutPlacement: 'flow' },
    'evaluation-result': { calloutTarget: '[data-guide-round="MID"]', calloutAvoidClosest: '[data-guide-round="MID"]', calloutPlacement: 'flow' },
  }[step.id];
  const current = placement ? { ...step, ...placement } : step;
  if (['manager-member', 'manager-material'].includes(step.id) && member?.kind === 'member'
    && member.task?.taskId !== managerGuideTaskId) return {
    ...current, title: '‘사용자 인터뷰 계획’을 선택하세요',
    description: '지금은 다른 작업을 보고 있습니다. 작업 목록에서 ‘사용자 인터뷰 계획’을 선택해 주세요. 목록에 없다면 ‘안내 위치’를 누르면 작업 필터와 선택을 복원합니다.',
    target: null, actionTarget: `[data-guide-manager-task="${managerGuideTaskId}"]`, calloutAvoidClosest: null,
  };
  if (step.id === 'manager-material' && source?.expanded && source.teamId === 1
    && source.taskId === managerGuideTaskId && source.deliverableId === managerGuideDeliverableId) {
    if (managerGuideReady(step.id, member, source)) return {
      ...current, title: '원문과 수행 설명을 함께 확인하세요',
      description: '연결된 원문을 열었습니다. 실제 산출물 내용과 이 작업의 수행 설명을 비교한 뒤 ‘산출물 확인 완료’를 눌러 주세요.',
    };
    return { ...current,
      title: source.loading ? '연결된 원문을 불러오고 있습니다' : '산출물 조회 상태를 확인하세요',
      description: source.loading ? '원문을 불러온 뒤 수행 설명과 비교할 수 있습니다. 조회가 끝나면 다음 안내가 표시됩니다.'
        : source.error ? '원문을 불러오지 못했습니다. 산출물 영역의 오류를 확인하고 다시 불러와 주세요. 정상 조회 전에는 확인을 완료할 수 없습니다.'
          : '연결된 산출물의 본문과 버전이 확인되지 않았습니다. ‘수행 상세 새로고침’으로 최신 연결을 확인해 주세요.',
      target: null, actionTarget: null, calloutTarget: `[data-guide-manager-deliverable="${managerGuideDeliverableId}"]`,
    };
  }
  if (['management-report-review', 'management-report-evidence'].includes(step.id)) {
    if (reportResult?.teamId !== 1) return {
      ...current, title: '삼위일체의 리포트를 확인하세요',
      description: reportResult ? '지금은 다른 팀의 리포트를 보고 있습니다. 상세 패널을 닫고 삼위일체의 ‘리포트 확인’을 누르거나 ‘안내 위치’를 눌러 현재 단계로 돌아오세요.'
        : '팀별 리포트 목록에서 삼위일체의 ‘리포트 확인’을 눌러 결과를 열어 주세요.',
      target: null, actionTarget: '[data-guide="choose-report-guide-team"]', calloutTarget: '.report-results-section', calloutContainer: '.report-results-section',
    };
    if (reportReview && reportReview.memberId !== managerGuideMemberId) return {
      ...current, title: '김하늘님의 결과를 선택하세요', description: '상세 조회 팀원에서 ‘김하늘’을 선택하세요. 상단의 ‘가이드 안내 위치’를 눌러 가이드의 팀원으로 돌아갈 수도 있습니다.',
      target: '[data-guide="report-member-selector"]', actionTarget: '[data-guide="report-member-selector"]',
      calloutTarget: '.report-member-evidence-heading', calloutContainer: '.report-member-evidence',
    };
    if (reportReview?.error) return { ...current, title: '작업 근거의 조회 상태를 확인하세요',
      description: '작업 근거를 불러오지 못했습니다. 오류를 확인하고 ‘작업 근거 새로고침’을 눌러 다시 조회하세요. 정상 조회 후 다음 단계로 진행할 수 있습니다.',
      target: '[data-guide="report-evidence-refresh"]', actionTarget: '[data-guide="report-evidence-refresh"]', calloutTarget: '.report-member-evidence', calloutContainer: '.report-member-evidence' };
    if (step.id === 'management-report-review' && reportReviewReady) return {
      ...current, target: '.report-member-evidence .report-score-total, .report-member-evidence .report-score-components > dl',
      calloutTarget: '.report-member-evidence', calloutContainer: '.report-member-evidence',
      actionTarget: '[data-guide="confirm-management-report-review"]',
      description: '김하늘님의 종합점수와 원점수 → 평가 비중 → 반영 점수를 확인하세요. 아래에서 중간·최종 평가 결과도 전환할 수 있습니다. 확인한 뒤 ‘점수 검토 완료’를 누르면 작업 근거로 이동합니다.',
    };
    if (step.id === 'management-report-evidence' && reportEvidence?.openedTaskId === managerGuideTaskId) {
      const source = reportEvidence.source;
      if (source?.taskId === managerGuideTaskId && source.materialId === managerGuideDeliverableId) {
        if (source.ready && !source.loading && !source.error) return { ...current,
          title: '수행 설명과 산출물 원문을 함께 확인하세요',
          description: '연결된 문서를 열었습니다. 수행 설명과 실제 결과물을 비교하세요. 점수는 리포트 집계 기준이며 산출물은 현재 자료입니다. ‘작업 근거 검토 완료’를 누르면 상세 패널을 닫고 전체 공개로 이동합니다.',
          target: '[data-guide="report-material-preview"]', actionTarget: '[data-guide="confirm-management-report-evidence"]' };
        return { ...current, title: source.loading ? '연결 문서를 불러오고 있습니다' : '연결 문서의 조회 상태를 확인하세요',
          description: source.loading ? '본문을 불러온 뒤 수행 설명과 비교할 수 있습니다. 잠시 기다려 주세요.' : '문서를 불러오지 못했습니다. 문서 영역에서 다시 불러온 뒤 검토를 마쳐 주세요.',
          target: '[data-guide="report-material-preview"]', actionTarget: null };
      }
      return { ...current, title: '‘인터뷰 계획과 질문 목록’을 열어 보세요',
        description: '수행 설명을 확인한 뒤 연결된 ‘인터뷰 계획과 질문 목록’을 직접 누르세요. 원문을 정상적으로 불러와야 검토를 완료할 수 있습니다.',
        target: `[data-guide-report-task-body="${managerGuideTaskId}"]`, actionTarget: `[data-guide-report-material="${managerGuideDeliverableId}"]` };
    }
  }
  return current;
}
export function materialsGuideReady(stepId, { status, answer, source } = {}) {
  if (stepId === 'materials-overview') return status?.teamId === 1 && status.enabled === true && status.readyCount > 0;
  const hasAnswer = answer?.teamId === 1 && answer.answerable === true && answer.references?.length > 0;
  if (stepId === 'materials-question' || stepId === 'materials-answer') return Boolean(hasAnswer);
  if (stepId === 'materials-source') return Boolean(hasAnswer && source?.ready && source.teamId === 1
    && answer.references.some((reference) => reference.deliverableId === source.deliverableId
      && reference.deliverableVersion === source.deliverableVersion
      && reference.startLine === source.startLine && reference.endLine === source.endLine));
  return false;
}
export function materialsSourceGuideStep(step, { answer, source } = {}) {
  if (step.id !== 'materials-source' || !source) return step;
  const matchingCitation = answer?.teamId === source.teamId && answer?.references?.some((reference) =>
    reference.deliverableId === source.deliverableId && reference.deliverableVersion === source.deliverableVersion
      && reference.startLine === source.startLine && reference.endLine === source.endLine);
  if (!matchingCitation) return { ...step, title: '답변의 근거 자료를 열어 주세요',
    description: '현재 연 자료는 답변에서 인용한 원문과 다릅니다. 답변 아래 근거 자료의 ‘원문 확인’을 눌러 주세요.',
    target: '[data-guide="open-material-citation"]', calloutTarget: '[data-guide="open-material-citation"]' };
  if (source.loading) return { ...step, title: '근거 원문을 불러오고 있습니다',
    description: '원문을 불러온 뒤 강조된 내용과 답변의 인용문을 비교할 수 있습니다. 잠시 기다려 주세요.',
    target: '.rag-source-message', calloutTarget: '.rag-source-message', actionTarget: null };
  if (source.error || !materialsGuideReady(step.id, { answer, source })) return { ...step, title: '원문 조회 상태를 확인하세요',
    description: '원문이나 인용 위치를 확인하지 못했습니다. 원문 패널의 안내를 확인해 주세요. 정상적으로 조회되기 전에는 원문 확인을 완료할 수 없습니다.',
    target: '.rag-source-meta', calloutTarget: '.rag-source-meta', actionTarget: null };
  return { ...step, title: '강조된 원문과 인용 내용을 비교하세요',
    description: '원문이 열렸습니다. 강조된 부분과 답변의 인용문·줄 번호를 비교하세요. 확인한 뒤 ‘원문 확인 완료’를 누르면 가이드를 마칩니다.',
    calloutContainer: '.rag-source-panel', calloutPlacement: 'flow' };
}
export const guideScenarios = [
  { id: 'task-completion', audience: 'member', title: '작업 완료하기', purpose: '산출물과 수행 기록을 남기고 작업을 완료합니다.', stepCount: guideSteps.length, available: true },
  { id: 'materials-search', audience: 'member', title: '팀 자료 검색하기', purpose: '팀 자료에 질문하고 답변의 원문 근거를 확인합니다.', stepCount: materialsGuideSteps.length, available: true },
  { id: 'peer-evaluation', audience: 'member', title: '동료 평가 제출하기', purpose: '팀원을 평가하고 최종 제출까지 진행합니다.', stepCount: peerGuideSteps.length, available: true },
  { id: 'contribution-report', audience: 'member', title: '내 기여도 확인하기', purpose: '본인 점수부터 동료 평가, 완료 작업과 산출물까지 확인합니다.', stepCount: contributionGuideSteps.length, available: true },
  { id: 'team-management', audience: 'manager', title: '팀 진행 상황 살펴보기', purpose: '팀의 진행 상황과 팀원의 수행 근거를 확인합니다.', stepCount: managerGuideSteps.length, available: true },
  { id: 'evaluation-management', audience: 'manager', title: '동료 평가 시작하기', purpose: '평가 일정을 설정하고 자동 시작 결과를 확인합니다.', stepCount: evaluationGuideSteps.length, available: true },
  { id: 'report-management', audience: 'manager', title: '리포트 생성·공개하기', purpose: '리포트를 생성하고 팀별 결과를 확인한 뒤 전체 공개합니다.', stepCount: reportManagementGuideSteps.length, available: true },
];
export function nextGuideScenario(scenarioId) {
  const current = guideScenarios.find((scenario) => scenario.id === scenarioId && scenario.available);
  if (!current) return null;
  const scenarios = guideScenarios.filter((scenario) => scenario.available && scenario.audience === current.audience);
  return scenarios[scenarios.findIndex((scenario) => scenario.id === scenarioId) + 1] ?? null;
}
// Persist only lifecycle/scope for isolation and reload handling, never step progress.
export function readGuideSession() {
  try {
    const state = JSON.parse(sessionStorage.getItem(guideStorageKey) || 'null');
    if (state?.version !== 1 || state.scope !== sessionStorage.getItem(guideScopeKey)
      || !['active', 'paused', 'completed'].includes(state.status)) return null;
    return { version: 1, scope: state.scope, originalRole: state.originalRole, status: state.status, scenarioId: guideScenarios.some((scenario) => scenario.id === state.scenarioId && scenario.available) ? state.scenarioId : 'task-completion' };
  } catch { return null; }
}
export function storeGuideSession(guide) {
  try {
    if (!guide) { sessionStorage.removeItem(guideStorageKey); return; }
    const { version, scope, originalRole, status, scenarioId } = guide;
    sessionStorage.setItem(guideStorageKey, JSON.stringify({ version, scope, originalRole, status, scenarioId }));
  } catch { /* Current tab still works when storage is unavailable. */ }
}
export function prepareGuide(scenarioId = 'task-completion') {
  if (!guideScenarios.some((scenario) => scenario.id === scenarioId && scenario.available))
    throw new Error('아직 준비되지 않은 가이드입니다.');
  const originalRole = readGuideSession()?.originalRole ?? previewRole();
  const scope = crypto.randomUUID();
  sessionStorage.setItem(guideScopeKey, scope);
  setPreviewRole(guideScenarios.find((scenario) => scenario.id === scenarioId).audience === 'manager' ? 'manager' : 'member');
  const context = previewContext();
  resetMockState(context, scenarioId === 'contribution-report' ? 'published' : scenarioId === 'report-management' ? 'review' : 'active');
  const state = getMockState(context);
  const entry = state.teams[1];
  const now = Date.now();
  if (scenarioId === 'task-completion') entry.tasks.push({
    ...entry.tasks[0], id: guideTaskId, title: '예시 작업: 조사 결과 정리',
    description: '조사 결과에서 핵심 발견을 정리하고 다음 단계 제안을 문서로 남겨 주세요.',
    status: 'IN_PROGRESS', version: 0, weight: 3,
    startAt: koreanDateTime(now - 86400000), dueAt: koreanDateTime(now + 7 * 86400000),
    createdAt: koreanDateTime(), updatedAt: koreanDateTime(), lastActivityAt: koreanDateTime(), completedAt: null,
    assignees: [{ userId: context.user.id, allocationPercent: 100 }],
    contributions: { [context.user.id]: null }, completionBlockReason: 'CONTRIBUTION_DESCRIPTION_REQUIRED',
  });
  if (scenarioId === 'contribution-report') {
    entry.deliverables.push({ id: reportGuideMaterialId, teamId: 1, taskId: reportGuideTaskId,
      title: '조사 결과 요약 문서', description: '수행 기록과 함께 확인하는 가이드 예시 자료',
      category: 'PLANNING', type: 'TEXT', text: guideExamples.deliverable.text, version: 1,
      authorId: context.user.id, createdAt: koreanDateTime(), updatedAt: koreanDateTime() });
  }
  if (scenarioId === 'peer-evaluation') {
    state.rounds = [{ id: guidePeerRoundId, spaceId: 1, type: 'FINAL', status: 'OPEN', version: 1,
      opensAt: koreanDateTime(now - 86400000), closesAt: koreanDateTime(now + 7 * 86400000) }];
    state.responses = {};
    state.submitted = {};
  }
  if (scenarioId === 'evaluation-management') {
    state.rounds = [];
    state.responses = {};
    state.submitted = {};
    state.spaceOverrides = { membershipLockedAt: null, teamBuildingStatus: 'CLOSED',
      teamBuildingOpensAt: koreanDateTime(now - 14 * 86400000), teamBuildingClosesAt: koreanDateTime(now - 86400000) };
  }
  if (scenarioId === 'report-management') {
    state.reports = [];
    state.reportWeights = null;
  }
  saveMockState(context, state);
  const guide = { version: 1, scope, scenarioId, originalRole, step: 0, status: 'active', initialProgress: workSummary(1, context.user.id, entry.tasks).teamProgressRate };
  storeGuideSession(guide);
  return guide;
}
// Read the saved result instead of treating an attempted click as a completed action.
export function completedGuideStep(guide, pathname, { aiFeedbackConfirmed = false, peerConfirmed = false } = {}) {
  if (['materials-search', 'contribution-report', 'team-management', 'evaluation-management', 'report-management'].includes(guide.scenarioId)) return false;
  const context = previewContext();
  if (context.user.id !== context.members[1].userId) return false;
  const entry = getMockState(context).teams[1];
  if (guide.scenarioId === 'peer-evaluation') {
    const state = getMockState(context);
    const round = state.rounds.find((item) => item.id === guidePeerRoundId);
    const targets = entry?.members.filter((member) => member.userId !== context.user.id) || [];
    const key = `${guidePeerRoundId}:${context.user.id}`;
    const saved = state.responses[key] || {};
    const allSaved = targets.length > 0 && targets.every((target) => saved[target.userId]);
    const stepId = peerGuideSteps[guide.step]?.id;
    if (stepId === 'peer-overview') return peerConfirmed && targets.length > 0 && round?.status === 'OPEN';
    if (stepId === 'peer-responses') return allSaved;
    if (stepId === 'peer-submit') return Boolean(allSaved && state.submitted[key]);
    if (stepId === 'peer-result') return Boolean(peerConfirmed && allSaved && state.submitted[key]);
    return false;
  }
  const task = entry?.tasks.find((task) => task.id === guideTaskId);
  if (!task) return false;
  const stepId = guideSteps[guide.step]?.id;
  if (stepId === 'team-progress') return pathname === `${guideHome}/tasks`;
  if (stepId === 'task') return pathname === guideTask;
  if (stepId === 'deliverable') return entry.deliverables.some((item) => item.taskId === guideTaskId && item.type === 'TEXT' && item.text?.trim());
  if (stepId === 'ai-feedback') {
    const review = getMockState(context).reviews?.[guideTaskId];
    return aiFeedbackConfirmed && review?.status === 'COMPLETED' && review.isCurrent === true;
  }
  if (stepId === 'contribution') return Boolean(task.contributions?.[context.user.id]?.trim());
  if (stepId === 'complete') return task.status === 'DONE';
  return false;
}

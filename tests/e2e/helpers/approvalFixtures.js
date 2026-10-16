import { space as baseSpace, team as baseTeam } from './resourceFixtures.js';

export const members = [
  { userId: 'member', name: '박서연', role: 'MEMBER' },
  { userId: 'leader', name: '김민준', role: 'LEADER' },
  { userId: 'colleague', name: '이지원', role: 'MEMBER' },
];
export const space = { ...baseSpace, name: '서비스 기획 프로젝트' };
export const team = {
  ...baseTeam,
  name: '삼위일체 팀',
  approvedMemberCount: 3,
};
export const tasks = [
  '서비스 기획 자료 정리',
  '설문 결과 검증',
  '디자인 시안 정리',
  'API 오류 응답 검증',
  '운영 체크리스트 작성',
  '발표 자료 최종 검증',
  '중간 발표 원고 정리',
  '인터뷰 결과 요약',
  '최종 발표 흐름 정리',
  '정책 예외 흐름 검증',
  '화면 전환 흐름 검증',
  '사용성 확인 결과 정리',
].map((title, index) => ({
  id: index + 10,
  teamId: 1,
  title,
  description: '팀에서 정한 완료 조건에 따라 결과와 검증 내용을 정리합니다.',
  status: index < 6 ? 'PENDING_APPROVAL' : index < 9 ? 'DONE' : 'IN_PROGRESS',
  completionReviewerId: 'member',
  weight: 3,
  startAt: '2030-11-01T09:00:00+09:00',
  dueAt: '2030-11-20T18:00:00+09:00',
  version: 1,
  assignees: [{
    userId: index % 2 ? 'colleague' : 'leader',
    allocationPercent: 100,
  }],
}));
export const approvals = tasks.map((task, index) => ({
  id: index + 100,
  taskId: task.id,
  status: index < 6 ? 'PENDING' : index < 9 ? 'APPROVED' : 'REJECTED',
  reviewerId: 'member',
  requesterId: task.assignees[0].userId,
  requestedAt: `2030-11-${String(index + 1).padStart(2, '0')}T10:00:00+09:00`,
  decidedAt: index < 6 ? null : '2030-11-15T10:00:00+09:00',
  reason: index < 9 ? null : '예외 상황의 검증 근거와 확인 결과를 추가해 주세요.',
}));

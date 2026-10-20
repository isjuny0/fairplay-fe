export const members = [
  { userId: 'member', name: '공동담당자이름'.repeat(4), role: 'MEMBER' },
  { userId: 'leader', name: '프로젝트리더이름'.repeat(4), role: 'LEADER' },
];
export const space = {
  id: 1,
  name: '여러 팀이 함께 사용하는 프로젝트 스페이스',
  myRole: 'USER',
  startAt: '2026-01-01T09:00:00+09:00',
  endAt: '2030-12-31T18:00:00+09:00',
  teamBuildingStatus: 'OPEN',
  version: 1,
};
export const team = {
  id: 1,
  spaceId: 1,
  name: '긴 자료와 많은 작업을 함께 관리하는 팀',
  leaderId: 'leader',
  approvedMemberCount: 2,
  myMembershipStatus: 'APPROVED',
  canCreateTask: true,
  teamBuildingStatus: 'OPEN',
};
export const tasks = Array.from({ length: 100 }, (_, index) => ({
  id: index + 10,
  teamId: 1,
  title: `${index + 1}. ${'ProjectRequirementAndVerification'.repeat(3)}`.slice(
    0,
    100,
  ),
  description: '요구사항과 수행 결과, 검증 방법과 한계를 함께 정리합니다.\n'
    .repeat(25)
    .slice(0, 1000),
  weight: 3,
  startAt: '2030-11-01T09:00:00+09:00',
  dueAt: '2030-11-20T18:00:00+09:00',
  status: ['TODO', 'IN_PROGRESS', 'REVISING', 'DONE'][index % 4],
  version: 1,
  assignees: [{ userId: 'member', allocationPercent: 100 }],
}));
export function deliverablePage(page = 0) {
  return Array.from({ length: 20 }, (_, index) => ({
    id: page * 20 + index + 1,
    teamId: 1,
    taskId: null,
    authorId: 'member',
    title:
      `${page ? '다음 페이지' : '현재 페이지'} ${index + 1} ${'ProjectDeliverable'.repeat(6)}`.slice(
        0,
        100,
      ),
    description: '자료의 목적과 확인할 내용입니다.\n'.repeat(80).slice(0, 2000),
    category: 'OTHER',
    type: 'FILE',
    version: 1,
    createdAt: '2030-11-01T09:00:00+09:00',
    updatedAt: '2030-11-02T10:00:00+09:00',
    file: {
      originalFilename:
        `${'project-deliverable-with-a-long-filename-'.repeat(6)}.md`.slice(
          -255,
        ),
      sizeBytes: 102400,
      contentType: 'text/markdown',
    },
  }));
}

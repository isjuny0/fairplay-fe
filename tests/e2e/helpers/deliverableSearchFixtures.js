import { space as baseSpace, team as baseTeam } from "./resourceFixtures.js";
export const members = [
  {
    userId: "00000000-0000-4000-8000-000000000001",
    name: "김민준",
    role: "LEADER",
  },
  {
    userId: "00000000-0000-4000-8000-000000000002",
    name: "박서연",
    role: "MEMBER",
  },
];
export const user = { id: members[1].userId, name: members[1].name };
export const space = { ...baseSpace, name: "서비스 기획 프로젝트" };
export const team = {
  ...baseTeam,
  name: "삼위일체 팀",
  leaderId: members[0].userId,
};
export const tasks = [
  {
    id: 10,
    teamId: 1,
    title: "사용자 조사 결과 정리",
    status: "IN_PROGRESS",
    completionReviewerId: members[0].userId,
    weight: 3,
    description: "조사 결과를 정리합니다.",
    assignees: [{ userId: user.id, allocationPercent: 100 }],
    version: 1,
    startAt: "2030-01-01T09:00:00+09:00",
    dueAt: "2030-12-01T18:00:00+09:00",
  },
];
export const deliverables = Array.from({ length: 45 }, (_, index) => ({
  id: index + 1,
  teamId: 1,
  taskId: index % 4 === 0 ? 10 : null,
  authorId: members[index % 3 === 0 ? 0 : 1].userId,
  title: `산출물 ${String(index + 1).padStart(2, "0")} · ${index % 2 ? "기획 문서" : "디자인 자료"}`,
  description: "현재 팀이 공유하는 최신 자료입니다.",
  category: index % 2 ? "PLANNING" : "DESIGN",
  type: index % 2 ? "TEXT" : "FILE",
  text: index % 2 ? "자료의 목적과 수행 결과, 검증 내용을 정리합니다." : null,
  file:
    index % 2
      ? null
      : {
          originalFilename: `result-${index + 1}.md`,
          contentType: "text/markdown",
          sizeBytes: 2048,
        },
  version: 1,
  createdAt: new Date(Date.UTC(2030, 0, index + 1, 1)).toISOString(),
  updatedAt: new Date(Date.UTC(2030, 0, index + 1, 1)).toISOString(),
}));
deliverables[0] = {
  ...deliverables[0],
  taskId: null,
  title: "오래된 정책 원본",
  category: "POLICY",
  updatedAt: "2031-01-01T01:00:00Z",
  file: { ...deliverables[0].file, originalFilename: "Policy_100%_final.md" },
};

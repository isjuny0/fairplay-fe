import { koreanDateTime } from '../lib/koreanTime.js';
import {
  capstoneProjectCalendarEntries, capstoneProjectTasks,
} from './capstoneProject.js';

export const previewPermissionChecklistFilename = '팀-권한-점검표.txt';
export const previewUsers = {
  participant: { id: '00000000-0000-4000-8000-000000000007', name: '한지민' },
  leader: { id: '00000000-0000-4000-8000-000000000001', name: '김준영' },
  member: { id: '00000000-0000-4000-8000-000000000002', name: '김영진' },
  teammate: { id: '00000000-0000-4000-8000-000000000003', name: '박선우' },
  manager: { id: '00000000-0000-4000-8000-000000000004', name: '신인철' },
};

export const previewMembers = Object.entries(previewUsers)
  .filter(([role]) => ['leader', 'member', 'teammate'].includes(role))
  .map(([role, user]) => ({
    userId: user.id,
    name: user.name,
    role: role === 'leader' ? 'LEADER' : 'MEMBER',
  }));

export const previewSpace = {
  id: 1,
  name: '2026 캡스톤디자인',
  description:
    '전공에서 배운 지식을 바탕으로 실제 문제를 해결하는 팀 프로젝트 수업입니다. 팀별로 주제를 정해 요구사항을 분석하고 해결책을 설계·구현합니다. 중간 점검에서 받은 피드백을 반영해 결과물을 개선하고, 학기 말에 최종 결과를 발표합니다.',
  startAt: '2026-09-01T00:00:00',
  endAt: '2026-12-31T23:59:00',
  teamBuildingOpensAt: '2026-09-01T00:00:00',
  teamBuildingClosesAt: '2026-09-15T23:59:00',
  teamBuildingStatus: 'LOCKED',
  membershipLockedAt: '2026-09-16T09:00:00',
  version: 1,
};

export const previewTeams = [
  {
    id: 1,
    spaceId: 1,
    name: '삼위일체',
    createdAt: '2026-10-01T09:00:00',
    leaderId: previewUsers.leader.id,
    approvedMemberCount: 3,
    canCreateTask: true,
  },
  {
    id: 2,
    spaceId: 1,
    name: '파도',
    createdAt: '2026-10-01T09:00:00',
    leaderId: '00000000-0000-4000-8000-000000000005',
    approvedMemberCount: 2,
    canCreateTask: false,
  },
];

export { peerCriteria, peerGuides } from '../lib/peerCriteria.js';

export const capstoneReviewDate = '2026-10-19';

export function exampleCalendarEvents(projectRecordsAt) {
  return [
    ['2026-09-16', '2026-09-17', '캡스톤디자인 설명회', 'milestone', '캡스톤디자인 프로젝트 일정과 운영 방식 안내'],
    [capstoneReviewDate, '2026-10-20', 'UI/UX 회의', 'meeting', '스페이스·팀 이동, 작업 보드, 결과물 등록 화면 점검'],
    ['2026-10-26', '2026-10-27', 'UI/UX·기능 개선 논의', 'meeting', 'Fairplay 화면 구성과 사용 흐름 점검'],
    ...(projectRecordsAt ? capstoneProjectCalendarEntries(projectRecordsAt) : []),
  ].map(([day, nextDay, title, kind, notes], index) => ({
    id: index + 1,
    teamId: previewTeams[0].id,
    title,
    kind,
    notes,
    allDay: true,
    startAt: `${day}T00:00:00`,
    endAt: `${nextDay}T00:00:00`,
    schedule: { mode: 'single' },
    authorId: previewUsers.leader.id,
    version: 0,
    createdAt: `${day}T00:00:00`,
    updatedAt: `${day}T00:00:00`,
  }));
}

const capstoneTasks = [
  [
    '스페이스·팀 권한 설계',
    '스페이스 관리자와 팀 리더·팀원의 권한을 구분합니다. 참여 코드 입장, 팀 가입, 작업 조회 흐름을 정리합니다.',
    '스페이스 참여와 팀 가입을 구분하고 역할별 작업 조회 범위를 점검표로 정리했습니다.',
  ],
  [
    '팀 자료 검색 개선',
    '질문과 답변 옆에 팀 자료 목록을 배치하고 인용에서 원문을 확인하는 흐름을 점검합니다. 근거가 부족한 질문의 안내도 확인합니다.',
    '검색 답변에 표시되는 인용 위치를 원문과 대조하고, 근거가 부족할 때의 안내를 정리했습니다.',
  ],
  [
    'AI 피드백 화면 개선',
    '작업에 연결한 결과물을 기준으로 AI 피드백의 요약, 개선 제안, 근거 위치를 읽기 쉽게 정리합니다.',
    '개선 제안과 검토한 결과물을 연결하고 결과물이 수정됐을 때 기존 피드백의 상태가 구분되는지 확인했습니다.',
  ],
  [
    '전시 가이드 동선 점검',
    '전시 링크에서 팀원·관리자 가이드를 열어 모바일 메뉴, 작업 상세, 자료 검색과 리포트 공개까지 확인합니다.',
    '모바일 메뉴에서 가이드 시작 위치를 확인하고 팀 홈에서 작업 상세로 이어지는 동선을 기록했습니다.',
  ],
  [
    '작업 목록 페이지 이동',
    '작업 표를 팀 자료·회의록과 맞추고, 20건씩 페이지를 이동하며 검색 조건과 상세 복귀를 확인합니다.',
    '작업 목록에 페이지 이동을 적용하고 상세에서 돌아올 때 검색 조건과 페이지가 복원되는지 확인했습니다.',
  ],
  [
    '종합 평가 리포트 연동',
    '완료 작업과 중간·최종 동료 평가가 종합점수에 어떻게 반영되는지 확인합니다. 공개된 리포트에서 팀원은 본인 결과를 조회합니다.',
    '공개된 리포트에서 종합점수, 항목별 평가 결과, 반영된 완료 작업을 본인 계정으로 확인했습니다.',
  ],
];

export function exampleTasks(team, members, now = Date.now(), projectRecordsAt) {
  if (!members.length) return [];
  const lead = members[0].userId;
  const second = members[1]?.userId || lead;
  const exhibitionReviewer = team.id === previewTeams[0].id
    ? members[2]?.userId
    : null;
  const states = [
    'DONE',
    'IN_PROGRESS',
    'REVISING',
    'TODO',
    'DONE',
    'DONE',
  ];
  const tasks = capstoneTasks.map(([title, description, contribution], index) => {
    const assignees = index === 1
      ? [{ userId: lead, allocationPercent: 60 }, { userId: second, allocationPercent: 40 }]
      : index === 3 && exhibitionReviewer
        ? [{ userId: second, allocationPercent: 50 }, { userId: exhibitionReviewer, allocationPercent: 50 }]
        : [{ userId: index % 2 ? second : lead, allocationPercent: 100 }];

    return {
      id: team.id * 100 + index + 1,
      teamId: team.id,
      title,
      description,
      weight: [3, 5, 3, 2, 5, 2][index],
      status: states[index],
      version: 1,
      startAt: koreanDateTime(now - (8 - index) * 86400000),
      dueAt: koreanDateTime(now + (index === 1 ? -86400000 : 7 * 86400000)),
      createdAt: koreanDateTime(now - 10 * 86400000),
      updatedAt: koreanDateTime(now - 3 * 86400000),
      completedAt: states[index] === 'DONE' ? koreanDateTime(now - 3 * 86400000) : null,
      lastActivityAt: koreanDateTime(now - 3 * 86400000),
      assignees,
      contributions: Object.fromEntries(
        assignees.map(({ userId }) => [
          userId,
          (index === 1 && userId === second) || (index === 3 && userId === exhibitionReviewer)
            ? null
            : contribution,
        ]),
      ),
      completionBlockReason:
        states[index] === 'IN_PROGRESS' ? null : 'INVALID_TASK_STATE',
    };
  });
  if (projectRecordsAt && team.id === previewTeams[0].id && members.length >= 3) {
    tasks.push(...capstoneProjectTasks(team.id, members, projectRecordsAt, now));
  }
  return tasks;
}

export const capstonePermissionChecklist = [
  'Fairplay 스페이스·팀 권한 점검표',
  '- 참여 코드는 스페이스 입장에 사용한다.',
  '- 팀 가입은 별도 신청이며 팀 리더가 검토한다.',
  '- 팀 작업은 소속 팀원과 해당 스페이스 관리자가 조회한다.',
  '- 공개 리포트에서 일반 팀원은 본인 결과를 확인한다.',
].join('\n');

export function exampleDeliverables(team, tasks, members, now = Date.now()) {
  const deliverables = [
    {
      id: team.id * 1000 + 1,
      teamId: team.id,
      taskId: null,
      title: 'Fairplay 프로젝트 소개',
      description: 'Fairplay의 개발 목표와 작업 범위',
      type: 'TEXT',
      text: [
        '목표: 팀 프로젝트의 역할과 수행 과정을 기록하고 기여도를 근거와 함께 확인합니다.',
        '대상: 대학 수업과 동아리의 팀 프로젝트.',
        '범위: 스페이스 참여와 팀 구성, 작업·결과물 기록, 팀 자료 검색, 동료 평가, 종합 평가 리포트.',
        '프론트엔드: React와 Vite. 백엔드: Spring Boot와 PostgreSQL.',
        ...(team.id === previewTeams[0].id ? [
          '',
          '삼위일체는 Fairplay의 작업 보드에 개발 항목을 나누고, 작업별 구현 결과와 점검 기록을 연결하는 흐름으로 진행합니다.',
          '',
          '팀원의 주요 개발 기록',
          `- ${previewUsers.leader.name} · 권한, AI 검토, 종합 평가와 [전시 가이드 진입](https://github.com/isjuny0/fairplay-fe/pull/282)`,
          `- ${previewUsers.member.name} · 알림과 회의록, [모바일 화면과 공통 UI](https://github.com/isjuny0/fairplay-fe/pull/269)`,
          `- ${previewUsers.teammate.name} · 팀 홈과 작업 상세, [팀 자료 검색 화면](https://github.com/isjuny0/fairplay-fe/pull/283)`,
          '',
          '이 미리보기의 작업 상태, 담당 비율, 평가 점수는 전시용 예시입니다.',
        ] : []),
      ].join('\n'),
      version: 1,
    },
    {
      id: team.id * 1000 + 2,
      teamId: team.id,
      taskId: tasks[0]?.id,
      title: '스페이스·팀 권한 정리',
      type: 'TEXT',
      text: [
        '참여 코드로 스페이스에 입장한 뒤 팀 가입을 별도로 신청합니다.',
        '팀 리더는 가입 신청을 검토하고, 담당자는 작업에 결과물과 수행 설명을 남깁니다.',
        '관리자는 팀 작업을 조회하며, 일반 팀원은 공개된 리포트에서 본인 결과만 확인합니다.',
        '프론트엔드 참고: [팀 가입 가능 여부 처리](https://github.com/isjuny0/fairplay-fe/pull/258), [종합 평가 화면](https://github.com/isjuny0/fairplay-fe/pull/213).',
      ].join('\n'),
      version: 1,
    },
    {
      id: team.id * 1000 + 3,
      teamId: team.id,
      taskId: tasks[1]?.id,
      title: '팀 자료 검색 검증 노트',
      authorId: members[2]?.userId,
      type: 'TEXT',
      text: [
        '답변에는 근거 자료 제목, 인용문, 원문 위치를 표시합니다.',
        '인용을 선택하면 원문을 열고 해당 부분을 확인할 수 있습니다.',
        '검증 항목: 검색 가능 자료, 자료 준비 상태, 근거가 부족한 질문의 안내.',
        '프론트엔드 참고: [팀 자료 검색·근거 원문 화면](https://github.com/isjuny0/fairplay-fe/pull/170), [검색 화면 배치 개선](https://github.com/isjuny0/fairplay-fe/pull/283).',
      ].join('\n'),
      version: 1,
    },
    {
      id: team.id * 1000 + 4,
      teamId: team.id,
      taskId: tasks[0]?.id,
      title: '팀 권한 점검표 파일',
      type: 'FILE',
      version: 1,
      file: {
        originalFilename: previewPermissionChecklistFilename,
        contentType: 'text/plain',
        sizeBytes: new TextEncoder().encode(capstonePermissionChecklist).length,
      },
    },
  ].map((item) => ({
    ...item,
    authorId: item.authorId ?? members[0]?.userId,
    createdAt: koreanDateTime(now),
    updatedAt: koreanDateTime(now),
  }));
  return deliverables;
}

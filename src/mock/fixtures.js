export const previewUsers = {
  participant: { id: '00000000-0000-4000-8000-000000000007', name: '한지민' },
  leader: { id: '00000000-0000-4000-8000-000000000001', name: '김하늘' },
  member: { id: '00000000-0000-4000-8000-000000000002', name: '이지원' },
  reviewer: { id: '00000000-0000-4000-8000-000000000003', name: '박서연' },
  manager: { id: '00000000-0000-4000-8000-000000000004', name: '정민수' },
};

export const previewMembers = Object.entries(previewUsers)
  .filter(([role]) => ['leader', 'member', 'reviewer'].includes(role))
  .map(([role, user]) => ({
    userId: user.id,
    name: user.name,
    isLeader: role === 'leader',
    isDeputy: role === 'reviewer',
  }));

export const previewSpace = {
  id: 1,
  name: '2026 서비스 디자인 프로젝트',
  description:
    '일상 속 불편을 발견하고, 조사부터 제안까지 함께 완성하는 프로젝트',
  startAt: '2026-09-01T00:00:00+09:00',
  endAt: '2030-12-31T23:59:00+09:00',
  teamBuildingOpensAt: '2026-09-01T00:00:00+09:00',
  teamBuildingClosesAt: '2026-09-15T23:59:00+09:00',
  teamBuildingStatus: 'LOCKED',
  membershipLockedAt: '2026-09-16T09:00:00+09:00',
  version: 1,
};

export const previewTeams = [
  {
    id: 1,
    spaceId: 1,
    name: '삼위일체',
    createdAt: '2026-10-01T00:00:00Z',
    leaderId: previewUsers.leader.id,
    deputyId: previewUsers.reviewer.id,
    approvedMemberCount: 3,
    canCreateTask: true,
  },
  {
    id: 2,
    spaceId: 1,
    name: '파도',
    createdAt: '2026-10-01T00:00:00Z',
    leaderId: '00000000-0000-4000-8000-000000000005',
    deputyId: null,
    approvedMemberCount: 2,
    canCreateTask: false,
  },
];

export const peerCriteria = {
  taskExecution: '작업 수행',
  responsibility: '책임감',
  collaboration: '협업',
  communication: '의사소통',
};
export const peerGuides = {
  taskExecution: [
    '담당 결과 미제출 또는 완료 조건 반복 미충족',
    '합의한 완료 조건에 맞는 결과를 제출',
    '담당 역할을 완수하고 다른 작업의 품질 개선에도 기여',
  ],
  responsibility: [
    '약속 미이행·지연 공유를 반복 누락',
    '기한을 지키고 장애물·지연을 미리 공유',
    '위험을 조기에 알리고 실행할 대안을 제안',
  ],
  collaboration: [
    '분담 조율·공동 작업에 참여하지 않음',
    '합의한 역할을 수행하고 필요한 협조 제공',
    '어려움을 지원하고 역할 충돌을 해결',
  ],
  communication: [
    '필요한 응답·진행 공유를 반복 누락',
    '진행 상황·의견·피드백을 필요한 때 교환',
    '불명확한 내용을 정리하고 의견 차이를 조율',
  ],
};

export function exampleTasks(team, members) {
  if (!members.length) return [];
  const lead = members[0].userId;
  const second = members[1]?.userId || lead;
  const reviewer = members[2]?.userId || second;
  const now = Date.now();
  const titles = [
    '사용자 인터뷰 계획',
    '설문 결과 분석',
    '서비스 흐름 설계',
    '프로토타입 사용성 검증',
    '최종 발표 자료',
    '조사 결과 요약',
  ];
  const states = [
    'DONE',
    'IN_PROGRESS',
    'PENDING_APPROVAL',
    'TODO',
    'DONE',
    'DONE',
  ];
  return titles.map((title, index) => ({
    id: team.id * 100 + index + 1,
    teamId: team.id,
    title,
    description:
      '조사 결과를 바탕으로 주요 발견과 개선안을 정리합니다. 결과에 근거와 다음 단계 제안을 포함해 주세요.',
    weight: [3, 5, 3, 2, 5, 2][index],
    status: states[index],
    version: 1,
    dueAt: new Date(
      now + (index === 1 ? -86400000 : 7 * 86400000),
    ).toISOString(),
    createdAt: new Date(now - 10 * 86400000).toISOString(),
    updatedAt: new Date(now - 3 * 86400000).toISOString(),
    lastActivityAt: new Date(now - 3 * 86400000).toISOString(),
    completionReviewerId: reviewer,
    assignees:
      index === 1
        ? [
            { userId: lead, allocationPercent: 60 },
            { userId: second, allocationPercent: 40 },
          ]
        : [{ userId: index % 2 ? second : lead, allocationPercent: 100 }],
    contributions: Object.fromEntries(
      (index === 1 ? [lead, second] : [index % 2 ? second : lead]).map(
        (userId) => [
          userId,
          index === 1 && userId === second
            ? null
            : '조사 자료를 정리하고 주요 발견과 개선안을 검토했습니다.',
        ],
      ),
    ),

    completionBlockReason:
      states[index] === 'IN_PROGRESS' ? null : 'INVALID_TASK_STATE',
  }));
}

export function exampleDeliverables(team, tasks, members) {
  return [
    {
      id: team.id * 1000 + 1,
      teamId: team.id,
      taskId: null,
      title: '프로젝트 기획서',
      description: '프로젝트 공용 자료',
      category: 'PLANNING',
      type: 'TEXT',
      text:
        '목표: 일상 속 불편을 조사하고 실행 가능한 서비스 개선안을 제안합니다.\n범위: 사용자 인터뷰, 설문 분석, 서비스 흐름, 사용성 검증, 발표.',
      version: 1,
    },
    {
      id: team.id * 1000 + 2,
      teamId: team.id,
      taskId: tasks[0]?.id,
      title: '인터뷰 계획과 질문 목록',
      category: 'PLANNING',
      type: 'TEXT',
      text:
        '목적과 대상자를 정의하고 인터뷰 질문 8개를 작성했습니다.\n관찰과 해석을 구분해 기록합니다.',
      version: 1,
    },
    {
      id: team.id * 1000 + 3,
      teamId: team.id,
      taskId: tasks[1]?.id,
      title: '설문 결과 분석 보고서',
      category: 'OTHER',
      type: 'TEXT',
      text:
        '응답을 문항별로 집계하고 주요 발견 세 가지를 정리했습니다.\n표본 범위와 분석 한계를 함께 안내합니다.',
      version: 1,
    },
    {
      id: team.id * 1000 + 4,
      teamId: team.id,
      taskId: tasks[0]?.id,
      title: '인터뷰 결과 기록 파일',
      category: 'OTHER',
      type: 'FILE',
      version: 1,
      file: {
        originalFilename: '인터뷰-기록.txt',
        contentType: 'text/plain',
        sizeBytes: 150,
      },
    },
  ].map((item) => ({
    ...item,
    authorId: members[0]?.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

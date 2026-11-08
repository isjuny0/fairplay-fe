import { koreanDateTime } from '../lib/koreanTime.js';

export const capstoneProjectScenario = 'project-records';

const dayMs = 86400000;
const frontend = 'https://github.com/isjuny0/fairplay-fe/pull';
const backend = 'https://github.com/isjuny0/fairplay-be/pull';

const projectWork = [
  {
    title: '팀 자료 검색 근거 검증',
    description: '같은 문서의 유사한 검색 결과를 정리하고, 인용에서 원문의 문단과 제목을 확인합니다.',
    status: 'DONE',
    weight: 5,
    days: [-21, -13, -14],
    allocations: [[2, 60], [1, 40]],
    contribution: '검색 답변의 인용문을 원문과 대조하고, 같은 문서의 여러 근거를 구분하는 검증 사례를 정리했습니다.',
    material: ['팀 자료 검색 재순위화 점검표', [
      '키워드 검색과 벡터 검색에서 모은 후보의 순서를 다시 정합니다.',
      '인용에서 해당 문단을 읽을 수 있도록 문서의 제목과 앞뒤 문맥을 함께 확인합니다.',
      `구현 근거 [백엔드 #169](${backend}/169)`,
    ]],
  },
  {
    title: 'AI 검토 근거와 재검토 흐름 정리',
    description: '피드백에 사용한 결과물과 버전을 확인하고, 결과물을 수정한 뒤 재검토가 필요한 상태를 구분합니다.',
    status: 'DONE',
    weight: 5,
    days: [-19, -12, -12],
    allocations: [[0, 100]],
    contribution: '개선 제안과 검토 근거의 연결, 결과물 수정 후 재검토가 필요한 상태를 확인했습니다.',
    material: ['AI 검토 응답 점검 기록', [
      '중요한 문제와 개선 제안을 나누고, 제안마다 검토에 사용한 근거를 확인합니다.',
      '결과물 버전과 검토 시각을 기록해 이후에 결과물이 바뀌었는지 확인합니다.',
      `구현 근거 [백엔드 #173](${backend}/173)`,
    ]],
  },
  {
    title: '중간 평가 마감 집계 검증',
    description: '중간 평가 마감 후 작업을 수정해도 마감 시점의 완료량과 담당 건수가 유지되는지 확인합니다.',
    status: 'DONE',
    weight: 5,
    days: [-10, -2, -3],
    allocations: [[1, 55], [0, 45]],
    contribution: '마감 전후의 작업 상태를 비교해 중간 피드백이 회차 마감 기준으로 표시되는지 확인했습니다.',
    material: ['중간 평가 마감 집계 기준', [
      '중간 동료 평가 결과와 내 작업 현황을 중간 평가 회차의 마감 시점 기준으로 표시합니다.',
      '마감 후 추가하거나 변경한 작업은 확정된 현황에 반영하지 않습니다.',
      `구현 근거 [프론트엔드 #388](${frontend}/388) · [백엔드 #186](${backend}/186)`,
    ]],
  },
  {
    title: '팀 탈퇴 작업별 인계 검증',
    description: '미완료 작업마다 다른 인계 대상을 선택하고, 재조회 후 여전히 유효한 선택만 복원되는지 확인합니다.',
    status: 'REVISING',
    weight: 3,
    days: [-8, 2],
    allocations: [[2, 50], [0, 50]],
    contribution: '리더와 팀원의 탈퇴 흐름에서 작업별 인계 대상이 유지되는 조건을 정리했습니다.',
    material: ['팀 탈퇴와 작업 인계 검증 시나리오', [
      '팀을 탈퇴할 때 미완료 작업별로 인계할 팀원을 선택합니다.',
      '확인 이후 작업 목록이나 버전이 바뀌면 새 목록을 조회해 다시 확인합니다.',
      `구현 근거 [프론트엔드 #386](${frontend}/386) · [백엔드 #184](${backend}/184)`,
    ]],
  },
  {
    title: '좁은 타임라인의 담당자 표시 확인',
    description: '한 달과 세 달 보기에서 담당자 표시와 제목 미리보기가 작업 행을 읽는 데 방해되지 않는지 확인합니다.',
    status: 'IN_PROGRESS',
    weight: 2,
    days: [-4, 3],
    allocations: [[0, 70], [2, 30]],
    contribution: '작업 제목 영역과 일정 막대의 미리보기 동작을 비교하고 여러 담당자 표시를 점검했습니다.',
    material: ['작업 타임라인 화면 점검표', [
      '작업 제목의 미리보기는 제목 위에서 확인합니다. 제목 옆 빈 영역에서는 열리지 않습니다.',
      '일정 막대에서 담당자 아이콘을 확인합니다. 짧은 막대와 여러 담당자가 있는 작업을 함께 점검합니다.',
      `구현 근거 [프론트엔드 #387](${frontend}/387)`,
    ]],
  },
  {
    title: '모바일 회의록 읽기 흐름 점검',
    description: '모바일에서 회의 일시와 참석자를 확인하고 안건, 회의 내용, 결정 사항을 순서대로 읽어 봅니다.',
    status: 'IN_PROGRESS',
    weight: 2,
    days: [-3, 5],
    allocations: [[1, 100]],
  },
  {
    title: '알림과 할 일 이동 동선 점검',
    description: '헤더의 알림과 할 일에서 대상 작업이나 평가 화면을 열고 중복된 이동 버튼이 없는지 확인합니다.',
    status: 'TODO',
    weight: 2,
    days: [1, 6],
    allocations: [[2, 100]],
  },
  {
    title: '리포트 공개 범위 최종 점검',
    description: '관리자가 평가 비중을 확인하고 리포트를 공개한 뒤, 팀원으로 전환해 본인 결과와 반영된 작업을 확인합니다.',
    status: 'TODO',
    weight: 3,
    days: [2, 7],
    allocations: [[0, 50], [1, 50]],
    material: ['리포트 생성·공개 확인 순서', [
      '관리자는 평가 비중을 확인하고 팀별 종합점수와 작업 근거를 검토한 뒤 리포트를 공개합니다.',
      '공개된 리포트에서 일반 팀원은 본인의 종합점수와 점수에 반영된 완료 작업을 확인합니다.',
      `구현 근거 [프론트엔드 #378](${frontend}/378) · [백엔드 #165](${backend}/165)`,
    ]],
  },
];

const projectTaskId = (index) => 121 + index;

export function capstoneProjectTasks(teamId, members, now, asOf = now) {
  const date = (offset) => koreanDateTime(now + offset * dayMs);
  return projectWork.flatMap((work, index) => {
    const [start, due, completed] = work.days;
    const elapsedDays = (asOf - now) / dayMs;
    if (elapsedDays < start - 3) return [];
    const isComplete = completed != null && completed <= elapsedDays;
    const status = elapsedDays < start || work.status === 'TODO'
      ? 'TODO'
      : work.status === 'DONE' && !isComplete ? 'IN_PROGRESS' : work.status;
    const activity = isComplete ? completed : elapsedDays < start ? start - 3 : start;
    const assignees = work.allocations.map(([memberIndex, allocationPercent]) => ({
      userId: members[memberIndex].userId,
      allocationPercent,
    }));
    return [{
      id: projectTaskId(index),
      teamId,
      title: work.title,
      description: work.description,
      weight: work.weight,
      status,
      version: 1,
      createdAt: date(start - 3),
      startAt: date(start),
      dueAt: date(due),
      updatedAt: date(activity),
      completedAt: isComplete ? date(completed) : null,
      lastActivityAt: date(activity),
      assignees,
      contributions: Object.fromEntries(assignees.map(({ userId }) => [userId, status === 'TODO' ? null : work.contribution ?? null])),
    }];
  });
}

export function capstoneProjectMaterials(tasks) {
  return projectWork
    .map((work, index) => ({ material: work.material, taskId: projectTaskId(index) }))
    .filter(({ material }) => material)
    .map(({ material, taskId }, index) => {
      const task = tasks.find((item) => item.id === taskId);
      const [title, lines] = material;
      return {
        id: 1005 + index,
        teamId: task.teamId,
        taskId,
        title,
        type: 'TEXT',
        text: [...lines, '전시용 점검 기록입니다.'].join('\n\n'),
        authorId: task.assignees[0].userId,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
        version: 1,
      };
    });
}

const projectMeetings = [
  {
    title: '자료 검색·AI 검토 구현 점검',
    day: -6,
    agenda: '- 자료 검색 인용과 원문 연결\n- AI 검토 근거와 결과물 버전',
    content: `전시용 재구성입니다. [검색 재순위화](${backend}/169)와 [AI 검토 응답](${backend}/173)의 변경 내용을 검토했습니다.`,
    decisions: '- 답변의 인용문을 원문에서 확인하는 사례를 준비합니다.\n- 결과물 수정 후 재검토가 필요한 사례를 추가합니다.',
  },
  {
    title: '중간 피드백·팀 운영 점검',
    day: -3,
    agenda: '- 중간 평가 마감 시점의 작업 현황\n- 탈퇴 시 미완료 작업 인계',
    content: `전시용 재구성입니다. [중간 평가 마감 집계](${frontend}/388)와 [작업별 인계](${backend}/184) 흐름을 검토했습니다.`,
    decisions: '- 마감 전후의 작업을 구분해 예시를 구성합니다.\n- 인계 대상과 작업이 바뀐 경우를 나눠 검증합니다.',
  },
  {
    title: '모바일 화면·전시 동선 점검',
    day: -1,
    agenda: '- 모바일 회의록과 작업 타임라인\n- 알림과 할 일에서 작업으로 이동',
    content: `전시용 재구성입니다. [모바일 회의록](${frontend}/383), [알림과 할 일](${frontend}/382), [타임라인](${frontend}/387) 변경 내역을 확인했습니다.`,
    decisions: '- 좁은 화면에서 일정과 담당자를 함께 확인합니다.\n- 알림에서 작업 상세까지 이어지는 동선을 점검합니다.',
  },
];

export function capstoneProjectMeetings(team, members, now) {
  return projectMeetings.map(({ day, ...meeting }, index) => {
    const meetingAt = `${koreanDateTime(now + day * dayMs).slice(0, 10)}T15:00:00`;
    return {
      ...meeting,
      id: 21 + index,
      teamId: team.id,
      meetingAt,
      authorId: members[index].userId,
      authorName: members[index].name,
      attendees: members.map(({ userId, name }) => ({ userId, name })),
      version: 0,
      createdAt: meetingAt,
      updatedAt: meetingAt,
    };
  });
}

export function capstoneProjectCalendarEntries(now) {
  const milestones = [
    { day: 2, title: '모바일 전시 동선 리허설', notes: '팀 홈, 타임라인, 자료 검색을 순서대로 점검합니다.' },
    { day: 6, title: '종합 평가 리포트 공개 점검', notes: '관리자 검토와 팀원 본인 결과 조회를 확인합니다.' },
  ];
  return milestones.map(({ day, title, notes }) => [
    koreanDateTime(now + day * dayMs).slice(0, 10),
    koreanDateTime(now + (day + 1) * dayMs).slice(0, 10),
    title,
    'review',
    notes,
  ]);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskDateMarkers,
  taskMonthDays,
  tasksByDate,
  calendarWeekTasks,
  timelineWindow,
  timelineTaskPeriod,
  taskScheduleStatus,
} from '../src/lib/taskSchedule.js';

test('UTC 마감일은 한국 시간의 일자와 월에 배치한다', () => {
  assert.equal(taskDate('2026-10-31T14:59:59Z'), '2026-10-31');
  assert.equal(taskDate('2026-10-31T15:00:00Z'), '2026-11-01');
  const tasks = [
    { id: 1, startAt: '2026-10-30T00:00:00Z', dueAt: '2026-10-31T15:00:00Z' },
    {
      id: 2,
      startAt: '2026-11-01T00:00:00+09:00',
      dueAt: '2026-11-01T03:00:00+09:00',
    },
  ];
  assert.deepEqual(
    tasksByDate(tasks, taskMonthDays('2026-11'))
      .get('2026-11-01')
      .map((task) => task.id),
    [1, 2],
  );
});
test('조회 월은 실제 지원 연도와 두 자리 월만 허용한다', () => {
  for (const value of [
    '2026-00',
    '2026-13',
    '2026-1',
    '0000-01',
    '10000-01',
    '2026-11-01',
    null,
  ])
    assert.equal(isTaskMonth(value), false);
  for (const value of ['0001-01', '2026-11', '9999-12'])
    assert.equal(isTaskMonth(value), true);
});
test('월 이동은 연말 경계와 지원 연도 끝을 처리한다', () => {
  assert.equal(moveTaskMonth('2026-12', 1), '2027-01');
  assert.equal(moveTaskMonth('2027-01', -1), '2026-12');
  assert.equal(moveTaskMonth('0001-01', -1), null);
  assert.equal(moveTaskMonth('9999-12', 1), null);
});
test('월간 일정은 윤년과 시작 요일을 유지하고 일주일 단위로 끝난다', () => {
  const leap = taskMonthDays('2028-02');
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap.length % 7, 0);
  const november = taskMonthDays('2026-11');
  assert.equal(november[0], '2026-11-01');
  assert.equal(november.filter(Boolean).at(-1), '2026-11-30');
});
test('가까운 마감은 다음 마감부터 찾고 과거 작업뿐이면 마지막 마감을 사용한다', () => {
  const tasks = ['2026-09-01', '2026-12-03', '2026-11-01'].map((date) => ({
    dueAt: `${date}T10:00:00+09:00`,
  }));
  assert.equal(nearestTaskMonth(tasks, '2026-10-15'), '2026-11');
  assert.equal(nearestTaskMonth(tasks, '2027-01-01'), '2026-12');
  assert.equal(nearestTaskMonth([], '2026-10-15'), undefined);
});

test('캘린더는 시작·종료일을 포함한 모든 날짜에 작업을 배치하고 월 경계를 자른다', () => {
  const task = {
    id: 1,
    startAt: '2026-10-31T14:59:00Z',
    dueAt: '2026-11-03T00:00:00Z',
  };
  const grouped = tasksByDate([task], taskMonthDays('2026-11'));
  for (const date of ['2026-11-01', '2026-11-02', '2026-11-03'])
    assert.deepEqual(grouped.get(date), [task]);
  assert.deepEqual(grouped.get('2026-11-04'), []);
  const same = { ...task, startAt: task.dueAt };
  assert.equal(
    tasksByDate([same], taskMonthDays('2026-11')).get('2026-11-03').length,
    1,
  );
});
test('캘린더 점은 작업의 시작일과 마감일에만 상태별로 배치한다', () => {
  const task = {
    id: 1,
    status: 'IN_PROGRESS',
    startAt: '2026-11-03T00:00:00Z',
    dueAt: '2026-11-05T00:00:00Z',
  };
  const sameDay = {
    id: 2,
    status: 'TODO',
    startAt: '2026-11-05T00:00:00Z',
    dueAt: '2026-11-05T12:00:00Z',
  };
  const markers = taskDateMarkers([task, sameDay], taskMonthDays('2026-11'));
  assert.deepEqual(
    markers.get('2026-11-05').map(({ task: markerTask, type }) => [markerTask.id, type]),
    [[1, 'due'], [2, 'start'], [2, 'due']],
  );
  assert.deepEqual(markers.get('2026-11-04'), []);
});
test('캘린더 기간 막대는 주 경계에서 이어지고 겹치는 작업을 별도 행에 놓는다', () => {
  const tasks = [
    { id: 1, startAt: '2026-10-30T00:00:00Z', dueAt: '2026-11-09T00:00:00Z' },
    { id: 2, startAt: '2026-11-01T00:00:00Z', dueAt: '2026-11-02T00:00:00Z' },
    { id: 3, startAt: '2026-11-03T00:00:00Z', dueAt: '2026-11-04T00:00:00Z' },
  ];
  const segments = calendarWeekTasks(
    tasks,
    taskMonthDays('2026-11').slice(0, 7),
  );
  assert.deepEqual(
    segments.map(
      ({ startColumn, endColumn, lane, continuesBefore, continuesAfter }) => ({
        startColumn,
        endColumn,
        lane,
        continuesBefore,
        continuesAfter,
      }),
    ),
    [
      {
        startColumn: 1,
        endColumn: 7,
        lane: 0,
        continuesBefore: true,
        continuesAfter: true,
      },
      {
        startColumn: 1,
        endColumn: 2,
        lane: 1,
        continuesBefore: false,
        continuesAfter: false,
      },
      {
        startColumn: 3,
        endColumn: 4,
        lane: 1,
        continuesBefore: false,
        continuesAfter: false,
      },
    ],
  );
});
test('3개월 범위는 연말·윤년·지원 연도 경계와 주간 눈금을 처리한다', () => {
  const window = timelineWindow('2026-11');
  assert.deepEqual(window.months, ['2026-11', '2026-12', '2027-01']);
  assert.equal(window.first, '2026-11-01');
  assert.equal(window.last, '2027-01-31');
  assert.equal(window.dayCount, 92);
  assert.deepEqual(
    window.weeks.slice(0, 2).map(({ date }) => date),
    ['2026-11-01', '2026-11-08'],
  );
  assert.equal(timelineWindow('2028-01').dayCount, 91);
  assert.equal(timelineWindow('9999-12').months.length, 1);
  assert.equal(timelineWindow('0001-01').first, '0001-01-01');
});
test('3개월을 가로지르는 기간은 양 끝을 자르고 같은 날 일정도 유지한다', () => {
  const window = timelineWindow('2026-11'),
    now = Date.parse('2026-10-15T00:00:00Z');
  const task = {
    status: 'TODO',
    startAt: '2026-10-31T14:59:00Z',
    dueAt: '2027-02-01T00:00:00Z',
  };
  assert.deepEqual(timelineTaskPeriod(task, window, now).planned, {
    left: 0,
    width: 100,
    continuesBefore: true,
    continuesAfter: true,
  });
  const instant = '2026-11-01T00:00:00+09:00';
  assert.equal(
    timelineTaskPeriod(
      { ...task, startAt: instant, dueAt: instant },
      window,
      now,
    ).planned.width,
    100 / 92,
  );
  assert.equal(timelineTaskPeriod(task, timelineWindow('2028-01'), now), null);
});
test('완료 작업은 지연으로 판단하지 않고 미완료의 마감·시작 예정일 경과를 구분한다', () => {
  const now = Date.parse('2026-11-15T09:00:00Z');
  const task = {
    startAt: '2026-11-01T09:00:00Z',
    dueAt: '2026-11-12T09:00:00Z',
    status: 'IN_PROGRESS',
  };
  assert.deepEqual(taskScheduleStatus(task, now), {
    overdue: true,
    startPassed: false,
    label: '3일 지연',
  });
  assert.equal(
    taskScheduleStatus({ ...task, status: 'DONE' }, now).overdue,
    false,
  );
  assert.equal(
    taskScheduleStatus(
      { ...task, status: 'TODO', dueAt: '2026-12-01T00:00:00Z' },
      now,
    ).startPassed,
    true,
  );
  assert.equal(
    taskScheduleStatus(
      { ...task, status: 'IN_PROGRESS', dueAt: '2026-12-01T00:00:00Z' },
      now,
    ).startPassed,
    false,
  );
});
test('이전 기간 마감 후 미완료 작업은 오늘까지 지연 구간이 겹치면 표시한다', () => {
  const task = {
    startAt: '2026-10-01T00:00:00Z',
    dueAt: '2026-10-31T00:00:00Z',
    status: 'IN_PROGRESS',
  };
  const period = timelineTaskPeriod(
    task,
    timelineWindow('2026-11'),
    Date.parse('2026-11-15T00:00:00Z'),
  );
  assert.equal(period.planned, null);
  assert.equal(period.delay.left, 0);
  assert.equal(period.delay.width, (15 / 92) * 100);
  assert.equal(
    timelineTaskPeriod(
      { ...task, status: 'DONE' },
      timelineWindow('2026-11'),
      Date.parse('2026-11-15T00:00:00Z'),
    ),
    null,
  );
});

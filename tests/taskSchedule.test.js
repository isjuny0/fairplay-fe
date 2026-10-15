import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskMonthDays,
  tasksByDate,
  taskMonthRange,
} from '../src/lib/taskSchedule.js';

test('UTC 마감일은 한국 시간의 일자와 월에 배치한다', () => {
  assert.equal(taskDate('2026-10-31T14:59:59Z'), '2026-10-31');
  assert.equal(taskDate('2026-10-31T15:00:00Z'), '2026-11-01');
  const tasks = [
    { id: 1, dueAt: '2026-10-31T15:00:00Z' },
    { id: 2, dueAt: '2026-11-01T03:00:00+09:00' },
  ];
  assert.deepEqual(
    tasksByDate(tasks)
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

test('계획 일정은 마감 월 밖에서도 겹치는 달에 표시하고 양 끝을 자른다', () => {
  const task = {
    startAt: '2026-10-31T14:59:00Z',
    dueAt: '2026-12-01T00:00:00Z',
  };
  assert.deepEqual(taskMonthRange(task, '2026-11'), {
    startDay: 1,
    endDay: 30,
    continuesBefore: true,
    continuesAfter: true,
  });
  assert.equal(taskMonthRange(task, '2027-01'), null);
  assert.equal(taskMonthRange(task, '2026-09'), null);
});
test('같은 시각·같은 날 일정과 월 경계는 최소 하루의 기간으로 표시한다', () => {
  const instant = '2026-10-31T15:00:00Z';
  assert.deepEqual(
    taskMonthRange({ startAt: instant, dueAt: instant }, '2026-11'),
    {
      startDay: 1,
      endDay: 1,
      continuesBefore: false,
      continuesAfter: false,
    },
  );
  assert.deepEqual(
    taskMonthRange(
      {
        startAt: '2028-02-29T00:00:00+09:00',
        dueAt: '2028-03-01T00:00:00+09:00',
      },
      '2028-02',
    ),
    {
      startDay: 29,
      endDay: 29,
      continuesBefore: false,
      continuesAfter: true,
    },
  );
});

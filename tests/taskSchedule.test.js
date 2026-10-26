import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTaskView } from '../src/lib/taskViewPreferences.js';
import {
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  timelineWindow,
  timelineTaskPeriod,
  taskScheduleStatus,
} from '../src/lib/taskSchedule.js';

test('UTC 마감일은 한국 시간의 일자와 월에 배치한다', () => {
  assert.equal(taskDate('2026-10-31T23:59:59'), '2026-10-31');
  assert.equal(taskDate('2026-11-01T00:00:00'), '2026-11-01');
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
test('가까운 마감은 다음 마감부터 찾고 과거 작업뿐이면 마지막 마감을 사용한다', () => {
  const tasks = ['2026-09-01', '2026-12-03', '2026-11-01'].map((date) => ({
    dueAt: `${date}T10:00:00+09:00`,
  }));
  assert.equal(nearestTaskMonth(tasks, '2026-10-15'), '2026-11');
  assert.equal(nearestTaskMonth(tasks, '2027-01-01'), '2026-12');
  assert.equal(nearestTaskMonth([], '2026-10-15'), undefined);
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
    startAt: '2026-10-31T23:59:00',
    dueAt: '2027-02-01T09:00:00',
  };
  assert.deepEqual(timelineTaskPeriod(task, window, now).planned, {
    left: 0,
    width: 100,
    continuesBefore: true,
    continuesAfter: true,
  });
  const instant = '2026-11-01T00:00:00';
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
    startAt: '2026-11-01T18:00:00',
    dueAt: '2026-11-12T18:00:00',
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
      { ...task, status: 'TODO', dueAt: '2026-12-01T09:00:00' },
      now,
    ).startPassed,
    true,
  );
  assert.equal(
    taskScheduleStatus(
      { ...task, status: 'IN_PROGRESS', dueAt: '2026-12-01T09:00:00' },
      now,
    ).startPassed,
    false,
  );
});
test('이전 기간 마감 후 미완료 작업은 오늘까지 지연 구간이 겹치면 표시한다', () => {
  const task = {
    startAt: '2026-10-01T09:00:00',
    dueAt: '2026-10-31T09:00:00',
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

test('이전 캘린더 보기는 목록으로 전환하고 지원하지 않는 보기는 보드로 복구한다', () => {
  assert.equal(normalizeTaskView('calendar'), 'list');
  for (const view of ['board', 'list', 'timeline']) assert.equal(normalizeTaskView(view), view);
  for (const view of [null, undefined, 'unknown', '']) assert.equal(normalizeTaskView(view), 'board');
});

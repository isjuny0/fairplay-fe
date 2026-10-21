import test from 'node:test';
import assert from 'node:assert/strict';
import {
  taskOverview,
  validateCalendarEvent,
  calendarMonthDays,
  calendarRelativeDay,
} from '../src/lib/teamDashboard.js';

const event = {
  id: 'a',
  title: '주간 회의',
  date: '2026-10-21',
  kind: 'meeting',
  start: '',
  end: '',
  notes: '',
};
test('월간 달력은 앞뒤 달을 채우고 지원 연도 끝을 넘기지 않는다', () => {
  const october = calendarMonthDays(2026, 9);
  assert.equal(october.length, 35);
  assert.equal(october[0], '2026-09-27');
  assert.equal(october.at(-1), '2026-10-31');
  assert.equal(calendarMonthDays(2028, 1).includes('2028-02-29'), true);
  assert.equal(calendarMonthDays(1, 0)[0], null);
  assert.equal(calendarMonthDays(9999, 11).at(-1), null);
});
test('날짜 상세는 오늘 기준으로 D-day를 표시하고 연도를 넘어 계산한다', () => {
  assert.equal(calendarRelativeDay('2026-10-21', '2026-10-21'), '오늘');
  assert.equal(calendarRelativeDay('2026-10-13', '2026-10-21'), 'D+8');
  assert.equal(calendarRelativeDay('2027-01-01', '2026-12-31'), 'D-1');
});
test('캘린더는 종일·시간 일정과 윤년을 검사하고 불완전한 시간을 거부한다', () => {
  assert.equal(validateCalendarEvent(event), '');
  assert.equal(
    validateCalendarEvent({
      ...event,
      date: '2028-02-29',
      start: '09:00',
      end: '10:00',
    }),
    '',
  );
  for (const patch of [
    { title: ' ' },
    { date: '2026-02-29' },
    { kind: 'toString' },
    { start: '09:00' },
    { start: '10:00', end: '09:00' },
    { start: '25:00', end: '26:00' },
  ]) {
    assert.notEqual(validateCalendarEvent({ ...event, ...patch }), '');
  }
});
test('다가오는 작업은 내 미완료 작업만 마감순으로, 7일 안을 구분한다', () => {
  const now = Date.parse('2026-10-21T00:00:00Z');
  const task = (id, date, status = 'TODO', userId = 'me') => ({
    id,
    dueAt: date,
    status,
    assignees: [{ userId }],
  });
  const tasks = [
    task(1, '2026-10-20T09:00:00'),
    task(2, '2026-11-01T09:00:00'),
    task(3, '2026-10-22T09:00:00'),
    task(4, '2026-10-22T09:00:00', 'DONE'),
    task(5, '2026-10-22T09:00:00', 'TODO', 'other'),
    task(6, null),
  ];
  const result = taskOverview(tasks, 'me', now);
  assert.deepEqual(
    result.overdue.map((t) => t.id),
    [1],
  );
  assert.deepEqual(
    result.upcoming.map((t) => t.id),
    [3, 2],
  );
  assert.deepEqual(
    result.soon.map((t) => t.id),
    [3],
  );
});

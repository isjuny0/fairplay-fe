import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarEventLanes,
  eventOccursOn,
  normalizeSchedule,
  validateSchedule,
} from '../src/lib/calendarSchedule.js';
import { calendarMonthDays } from '../src/lib/teamDashboard.js';
const makeEvent = (schedule, id = 'a') => ({
  id,
  title: '회의',
  date: schedule.startDate || schedule.dates[0],
  kind: 'meeting',
  notes: '',
  start: '',
  end: '',
  schedule,
});
test('기간은 월·연도를 넘어 양 끝을 포함한다', () => {
  const event = makeEvent({
    mode: 'range',
    startDate: '2026-12-30',
    endDate: '2027-01-02',
  });
  for (const date of ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    assert.equal(eventOccursOn(event, date), true);
  for (const date of ['2026-12-29', '2027-01-03'])
    assert.equal(eventOccursOn(event, date), false);
  assert.notEqual(
    validateSchedule({ ...event.schedule, endDate: '2026-12-29' }),
    '',
  );
});
test('주간 반복은 고른 요일과 시작·종료 경계만 반영한다', () => {
  const event = makeEvent({
    mode: 'repeat',
    frequency: 'weekly',
    weekdays: [1, 3],
    startDate: '2026-10-21',
    endDate: '2026-11-04',
  });
  for (const date of [
    '2026-10-21',
    '2026-10-26',
    '2026-10-28',
    '2026-11-02',
    '2026-11-04',
  ])
    assert.equal(eventOccursOn(event, date), true);
  for (const date of ['2026-10-19', '2026-10-22', '2026-11-09'])
    assert.equal(eventOccursOn(event, date), false);
  assert.equal(
    eventOccursOn(
      { ...event, schedule: { ...event.schedule, endDate: '' } },
      '2090-01-02',
    ),
    true,
  );
  assert.notEqual(validateSchedule({ ...event.schedule, weekdays: [] }), '');
});
test('매월 31일과 매년 윤일은 날짜가 없는 달·연도를 건너뛴다', () => {
  const month = makeEvent({
    mode: 'repeat',
    frequency: 'monthly',
    startDate: '2026-01-31',
    endDate: '',
  });
  assert.equal(eventOccursOn(month, '2026-02-28'), false);
  assert.equal(eventOccursOn(month, '2026-02-31'), false);
  assert.equal(eventOccursOn(month, '2026-03-31'), true);
  const year = makeEvent({
    mode: 'repeat',
    frequency: 'yearly',
    startDate: '2024-02-29',
    endDate: '',
  });
  assert.equal(eventOccursOn(year, '2025-02-28'), false);
  assert.equal(eventOccursOn(year, '2028-02-29'), true);
});
test('다중 날짜는 중복을 정리하고 고른 날만 표시한다', () => {
  const schedule = normalizeSchedule({
    mode: 'multiple',
    dates: ['2026-12-31', '2026-10-21', '2026-10-21'],
  });
  assert.deepEqual(schedule.dates, ['2026-10-21', '2026-12-31']);
  const event = makeEvent(schedule);
  assert.equal(eventOccursOn(event, '2026-10-21'), true);
  assert.equal(eventOccursOn(event, '2026-10-22'), false);
  assert.notEqual(validateSchedule({ mode: 'multiple', dates: [] }), '');
});
test('기간 막대는 주마다 같은 행을 쓰고 겹치는 일정은 다른 행에 배치한다', () => {
  const range = makeEvent({
    mode: 'range',
    startDate: '2026-10-13',
    endDate: '2026-10-19',
  });
  const point = makeEvent({ mode: 'single', startDate: '2026-10-14' }, 'b');
  const lanes = calendarEventLanes([point, range], calendarMonthDays(2026, 9));
  assert.equal(lanes.get('2026-10-14').slots[0].event.id, 'a');
  assert.equal(lanes.get('2026-10-14').slots[1].event.id, 'b');
  assert.equal(lanes.get('2026-10-18').slots[0].showTitle, true);
  assert.equal(lanes.get('2026-10-19').slots[0].endsHere, true);
});

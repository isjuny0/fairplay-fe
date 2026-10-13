import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDays,
  currentDateTime,
  dateKey,
  daysInMonth,
  isValidDate,
  shiftDate,
} from '../src/lib/dateTime.js';

test('날짜 기본값은 기존 API와 같은 한국 시간의 분 단위 입력이다', () => {
  const now = new Date();
  const actual = currentDateTime();
  assert.match(actual, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.ok(Math.abs(new Date(`${actual}:00+09:00`) - now) < 60000);
});
test('윤년과 월별 날짜 수 및 연도 1~99를 정확히 처리한다', () => {
  assert.equal(daysInMonth(2028, 1), 29);
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(daysInMonth(2000, 1), 29);
  assert.equal(daysInMonth(1900, 1), 28);
  assert.equal(daysInMonth(4, 1), 29);
  assert.equal(dateKey(4, 1, 29), '0004-02-29');
  for (const invalid of [
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-01-00',
    '0000-01-01',
    '2026-1-1',
  ])
    assert.equal(isValidDate(invalid), false);
  assert.equal(isValidDate('2028-02-29'), true);
});
test('달력은 시작 요일에 맞추고 방향키 이동은 월·연도를 넘는다', () => {
  const days = calendarDays(2026, 9);
  assert.deepEqual(days.slice(0, 5), [null, null, null, null, 1]);
  assert.equal(days.at(-1), 31);
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2028-03-01', -1), '2028-02-29');
});

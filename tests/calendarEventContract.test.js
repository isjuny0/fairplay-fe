import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarEventRequest,
  calendarEventFromResponse,
} from '../src/lib/calendarEventContract.js';
import { eventOccursOn } from '../src/lib/calendarSchedule.js';
import { validateCalendarEvent } from '../src/lib/teamDashboard.js';

const base = {
  title: '팀 회의',
  kind: 'meeting',
  notes: '',
  date: '2026-10-21',
  start: '',
  end: '',
};
test('종일 기간은 마지막 날짜 다음 날 00:00을 전송하고 표시할 때 포함 날짜로 복원한다', () => {
  const body = calendarEventRequest({
    ...base,
    schedule: { mode: 'range', startDate: base.date, endDate: '2026-11-03' },
  });
  assert.equal(body.startAt, '2026-10-21T00:00:00');
  assert.equal(body.endAt, '2026-11-04T00:00:00');
  assert.deepEqual(body.schedule, { mode: 'range' });
  const event = calendarEventFromResponse({ ...body, id: 1, version: 3 });
  assert.equal(event.version, 3);
  assert.equal(event.schedule.endDate, '2026-11-03');
  assert.equal(eventOccursOn(event, '2026-11-03'), true);
  assert.equal(eventOccursOn(event, '2026-11-04'), false);
});
test('반복 종료일은 until이고 다중 날짜는 정렬된 날짜 중 첫 날을 시작일로 사용한다', () => {
  const repeat = calendarEventRequest({
    ...base,
    start: '09:00',
    end: '10:00',
    schedule: {
      mode: 'repeat',
      startDate: base.date,
      endDate: '2026-12-01',
      frequency: 'weekly',
      weekdays: [3],
    },
  });
  assert.deepEqual(repeat.schedule, {
    mode: 'repeat',
    frequency: 'weekly',
    weekdays: [3],
    until: '2026-12-01',
  });
  assert.equal(
    calendarEventFromResponse(repeat).schedule.endDate,
    '2026-12-01',
  );
  const multiple = calendarEventRequest({
    ...base,
    schedule: { mode: 'multiple', dates: ['2026-12-01', '2026-10-21'] },
  });
  assert.equal(multiple.startAt, '2026-10-21T00:00:00');
  assert.deepEqual(multiple.schedule, {
    mode: 'multiple',
    dates: ['2026-10-21', '2026-12-01'],
  });
});
test('자정을 넘는 마지막 반복은 종료일 다음 날에도 표시하고 24시간을 넘는 반복은 거부한다', () => {
  const overnight = {
    ...base,
    start: '23:00',
    end: '01:00',
    endNextDay: true,
    schedule: {
      mode: 'repeat',
      startDate: base.date,
      endDate: base.date,
      frequency: 'weekly',
      weekdays: [3],
    },
  };
  assert.equal(validateCalendarEvent(overnight), '');
  const payload = calendarEventRequest(overnight);
  assert.equal(payload.endAt, '2026-10-22T01:00:00');
  const restored = calendarEventFromResponse(payload);
  assert.equal(eventOccursOn(restored, '2026-10-22'), true);
  assert.equal(eventOccursOn(restored, '2026-10-23'), false);
  assert.notEqual(validateCalendarEvent({ ...overnight, end: '23:30' }), '');
  assert.equal(
    eventOccursOn({ ...restored, end: '00:00' }, '2026-10-22'),
    false,
  );
});

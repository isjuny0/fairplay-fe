import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDateLabel } from '../src/lib/notificationDate.js';

test('알림 날짜 구분은 기기 시간대 대신 한국 날짜를 사용한다', () => {
  const now = Date.parse('2026-11-03T15:30:00Z');
  assert.equal(notificationDateLabel('2026-11-04T00:05:00', now), '오늘');
  assert.equal(notificationDateLabel('2026-11-03T23:50:00', now), '어제');
});
test('이전 알림은 전체 날짜를 표시한다', () => {
  assert.equal(notificationDateLabel('2026-10-20T09:00:00', Date.parse('2026-11-04T12:00:00+09:00')), '2026년 10월 20일');
});
test('잘못된 날짜를 오늘 알림으로 분류하지 않는다', () => {
  assert.equal(notificationDateLabel('invalid'), '날짜 확인 필요');
});

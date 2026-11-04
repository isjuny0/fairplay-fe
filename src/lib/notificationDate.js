import { apiTimeToEpoch } from './koreanTime.js';

const day = timestamp => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
export function notificationDateLabel(value, now = Date.now()) {
  const timestamp = apiTimeToEpoch(value);
  if (!Number.isFinite(timestamp)) return '날짜 확인 필요';
  const date = day(timestamp);
  if (date === day(now)) return '오늘';
  if (date === day(now - 86400000)) return '어제';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(timestamp);
}

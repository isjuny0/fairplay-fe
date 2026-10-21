const koreaOffsetMilliseconds = 9 * 60 * 60 * 1000;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

export function apiTimeToEpoch(value) {
  return typeof value === 'string' && localDateTimePattern.test(value)
    ? Date.parse(`${value}+09:00`)
    : NaN;
}

export function koreanDateTime(instant = Date.now()) {
  return new Date(Number(instant) + koreaOffsetMilliseconds)
    .toISOString()
    .slice(0, -1);
}

import { isValidDate } from './dateTime.js';

export const scheduleModes = {
  single: '일반',
  range: '기간',
  repeat: '반복',
  multiple: '다중',
};
export const repeatFrequencies = {
  weekly: '매주',
  monthly: '매월',
  yearly: '매년',
};
export const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
export const dateWeekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const singleSchedule = (date) => ({ mode: 'single', startDate: date });
export const eventSchedule = (event) =>
  event.schedule || singleSchedule(event.date);
export const scheduleAnchor = (schedule) =>
  schedule.mode === 'multiple'
    ? [...schedule.dates].sort()[0]
    : schedule.startDate;

export function validateSchedule(schedule) {
  if (!schedule || !Object.hasOwn(scheduleModes, schedule.mode))
    return '일정 날짜 유형을 선택해 주세요.';
  if (schedule.mode === 'multiple') {
    if (!Array.isArray(schedule.dates) || !schedule.dates.length)
      return '날짜를 한 개 이상 선택해 주세요.';
    return schedule.dates.every(isValidDate)
      ? ''
      : '올바른 날짜를 선택해 주세요.';
  }
  if (!isValidDate(schedule.startDate)) return '시작 날짜를 선택해 주세요.';
  if (schedule.mode === 'range' && !isValidDate(schedule.endDate))
    return '종료 날짜를 선택해 주세요.';
  if (
    schedule.endDate &&
    (!isValidDate(schedule.endDate) || schedule.endDate < schedule.startDate)
  )
    return '종료 날짜는 시작 날짜보다 빠를 수 없습니다.';
  if (schedule.mode === 'repeat') {
    if (!Object.hasOwn(repeatFrequencies, schedule.frequency))
      return '반복 유형을 선택해 주세요.';
    if (
      schedule.frequency === 'weekly' &&
      (!Array.isArray(schedule.weekdays) ||
        !schedule.weekdays.length ||
        !schedule.weekdays.every(
          (day) => Number.isInteger(day) && day >= 0 && day <= 6,
        ))
    )
      return '반복할 요일을 한 개 이상 선택해 주세요.';
  }
  return '';
}
export function normalizeSchedule(schedule) {
  if (schedule.mode === 'single') return singleSchedule(schedule.startDate);
  if (schedule.mode === 'multiple')
    return { mode: 'multiple', dates: [...new Set(schedule.dates)].sort() };
  if (schedule.mode === 'range')
    return {
      mode: 'range',
      startDate: schedule.startDate,
      endDate: schedule.endDate,
    };
  return {
    mode: 'repeat',
    startDate: schedule.startDate,
    endDate: schedule.endDate || '',
    frequency: schedule.frequency,
    ...(schedule.frequency === 'weekly'
      ? { weekdays: [...new Set(schedule.weekdays)].sort() }
      : {}),
  };
}
export function eventOccursOn(event, date) {
  if (!isValidDate(date)) return false;
  const schedule = eventSchedule(event);
  if (schedule.mode === 'single') return schedule.startDate === date;
  if (schedule.mode === 'multiple') return schedule.dates.includes(date);
  if (
    date < schedule.startDate ||
    (schedule.endDate && date > schedule.endDate)
  )
    return false;
  if (schedule.mode === 'range') return true;
  if (schedule.frequency === 'weekly')
    return schedule.weekdays.includes(dateWeekday(date));
  if (schedule.frequency === 'monthly')
    return date.slice(8) === schedule.startDate.slice(8);
  return date.slice(5) === schedule.startDate.slice(5);
}
const shortDate = (date) =>
  `${Number(date.slice(5, 7))}.${Number(date.slice(8))}`;
export function scheduleDescription(schedule) {
  if (schedule.mode === 'single') return shortDate(schedule.startDate);
  if (schedule.mode === 'range')
    return `${shortDate(schedule.startDate)} – ${schedule.endDate ? shortDate(schedule.endDate) : '종료 선택'}`;
  if (schedule.mode === 'multiple') return `${schedule.dates.length}일 선택`;
  const detail =
    schedule.frequency === 'weekly'
      ? ` ${schedule.weekdays.map((day) => calendarWeekdays[day]).join('·')}`
      : schedule.frequency === 'monthly'
        ? ` ${Number(schedule.startDate.slice(8))}일`
        : ` ${shortDate(schedule.startDate)}`;
  return `${repeatFrequencies[schedule.frequency]}${detail}`;
}

// Assign a consistent lane across each week so a range reads as one continuous bar.
export function calendarEventLanes(events, dates, maxRows = 2) {
  const result = new Map();
  for (let offset = 0; offset < dates.length; offset += 7) {
    const week = dates.slice(offset, offset + 7);
    const segments = [];
    for (const event of events) {
      const indices = week.flatMap((date, index) =>
        date && eventOccursOn(event, date) ? [index] : [],
      );
      if (!indices.length) continue;
      if (eventSchedule(event).mode === 'range')
        segments.push({
          event,
          from: indices[0],
          to: indices.at(-1),
          range: true,
        });
      else
        indices.forEach((index) =>
          segments.push({ event, from: index, to: index, range: false }),
        );
    }
    segments.sort(
      (a, b) =>
        Number(b.range) - Number(a.range) ||
        a.from - b.from ||
        (a.event.start || '').localeCompare(b.event.start || '') ||
        a.event.title.localeCompare(b.event.title, 'ko') ||
        String(a.event.id).localeCompare(String(b.event.id)),
    );
    const rows = [];
    week.forEach((date) => {
      if (date)
        result.set(date, { slots: Array(maxRows).fill(null), overflow: 0 });
    });
    for (const segment of segments) {
      let row = rows.findIndex((intervals) =>
        intervals.every(([from, to]) => to < segment.from || from > segment.to),
      );
      if (row < 0) {
        row = rows.length;
        rows.push([]);
      }
      rows[row].push([segment.from, segment.to]);
      for (let index = segment.from; index <= segment.to; index++) {
        const cell = result.get(week[index]);
        if (row >= maxRows) {
          cell.overflow++;
          continue;
        }
        cell.slots[row] = {
          ...segment,
          showTitle: index === segment.from,
          startsHere: week[index] === eventSchedule(segment.event).startDate,
          endsHere: week[index] === eventSchedule(segment.event).endDate,
        };
      }
    }
  }
  return result;
}

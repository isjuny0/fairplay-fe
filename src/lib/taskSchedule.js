import { apiTimeToEpoch, koreanDateTime } from './koreanTime.js';
import {
  dateKey,
  daysInMonth,
  isValidDate,
  shiftDate,
} from './dateTime.js';
import { toDateInput } from './domain.js';

export const taskDate = (value) => toDateInput(value).slice(0, 10);
export const currentTaskMonth = () =>
  koreanDateTime().slice(0, 10).slice(0, 7);
export const isTaskMonth = (value) =>
  typeof value === 'string' && isValidDate(`${value}-01`);

export function moveTaskMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + number - 1 + offset;
  const nextYear = Math.floor(index / 12);
  return nextYear >= 1 && nextYear <= 9999
    ? dateKey(nextYear, index % 12, 1).slice(0, 7)
    : null;
}

export function nearestTaskMonth(
  tasks,
  today = koreanDateTime().slice(0, 10),
) {
  const dates = tasks.map((task) => taskDate(task.dueAt)).sort();
  return (dates.find((date) => date >= today) || dates.at(-1))?.slice(0, 7);
}

const dayMilliseconds = 86400000;
const serialDate = (date) => Date.parse(`${date}T00:00:00Z`) / dayMilliseconds;

export function timelineWindow(month) {
  const months = [0, 1, 2]
    .map((offset) => moveTaskMonth(month, offset))
    .filter(Boolean);
  const first = `${months[0]}-01`;
  const [year, number] = months.at(-1).split('-').map(Number);
  const last = dateKey(year, number - 1, daysInMonth(year, number - 1));
  const dayCount = serialDate(last) - serialDate(first) + 1;
  const position = (date) =>
    ((serialDate(date) - serialDate(first)) / dayCount) * 100;
  const weeks = [];
  let date = first;
  while (serialDate(date) <= serialDate(last)) {
    if (weeks.length && serialDate(last) - serialDate(date) < 3) break;
    weeks.push({ date, left: position(date) });
    date = shiftDate(date, 7);
  }
  return { first, last, months, dayCount, weeks, position };
}

export function taskScheduleStatus(task, now = Date.now()) {
  if (task.status === 'DONE')
    return { overdue: false, startPassed: false, label: '' };
  const overdue = apiTimeToEpoch(task.dueAt) < now;
  const startPassed =
    !overdue && task.status === 'TODO' && apiTimeToEpoch(task.startAt) < now;
  const days = Math.floor((now - apiTimeToEpoch(task.dueAt)) / dayMilliseconds);
  return {
    overdue,
    startPassed,
    label: overdue
      ? days > 0
        ? `${days}일 지연`
        : '마감 지남'
      : startPassed
        ? '시작 예정일 지남'
        : '',
  };
}

export function timelineTaskPeriod(task, window, now = Date.now()) {
  const start = taskDate(task.startAt),
    due = taskDate(task.dueAt);
  const today = taskDate(koreanDateTime(now));
  const status = taskScheduleStatus(task, now);
  const position = (first, last) => ({
    left: window.position(first),
    width: ((serialDate(last) - serialDate(first) + 1) / window.dayCount) * 100,
  });
  const planned =
    start <= window.last && due >= window.first
      ? {
          ...position(
            start < window.first ? window.first : start,
            due > window.last ? window.last : due,
          ),
          continuesBefore: start < window.first,
          continuesAfter: due > window.last,
        }
      : null;
  const delayStart = shiftDate(due, 1);
  const delay =
    status.overdue &&
    due < today &&
    delayStart <= window.last &&
    today >= window.first &&
    delayStart <= today
      ? position(
          delayStart < window.first ? window.first : delayStart,
          today > window.last ? window.last : today,
        )
      : null;
  return planned || delay ? { ...status, planned, delay } : null;
}

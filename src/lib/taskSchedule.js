import { calendarDays, dateKey, isValidDate } from './dateTime.js';
import { toDateInput } from './domain.js';

export const taskDate = (value) => toDateInput(value).slice(0, 10);
export const currentTaskMonth = () =>
  taskDate(new Date().toISOString()).slice(0, 7);
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

export function taskMonthDays(month) {
  const [year, number] = month.split('-').map(Number);
  const days = calendarDays(year, number - 1).map((day) =>
    day == null ? null : dateKey(year, number - 1, day),
  );
  while (days.length % 7) days.push(null);
  return days;
}

export function tasksByDate(tasks) {
  const grouped = new Map();
  for (const task of tasks) {
    const date = taskDate(task.dueAt);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(task);
  }
  return grouped;
}

export function nearestTaskMonth(
  tasks,
  today = taskDate(new Date().toISOString()),
) {
  const dates = tasks.map((task) => taskDate(task.dueAt)).sort();
  return (dates.find((date) => date >= today) || dates.at(-1))?.slice(0, 7);
}

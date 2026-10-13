import { toDateInput } from './domain.js';

export const currentDateTime = () => toDateInput(new Date().toISOString());
export const dateKey = (year, month, day) =>
  `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month - 1);
}
export function daysInMonth(year, month) {
  const date = new Date(0);
  date.setUTCFullYear(year, month + 1, 0);
  return date.getUTCDate();
}
export function calendarDays(year, month) {
  const first = new Date(0);
  first.setUTCFullYear(year, month, 1);
  return [
    ...Array(first.getUTCDay()).fill(null),
    ...Array.from(
      { length: daysInMonth(year, month) },
      (_, index) => index + 1,
    ),
  ];
}
export function shiftDate(value, amount) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + amount);
  return dateKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

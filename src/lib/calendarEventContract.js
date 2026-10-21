import { shiftDate } from './dateTime.js';
import { eventSchedule, scheduleAnchor } from './calendarSchedule.js';

// API endAt is exclusive; the date picker uses inclusive dates.
export function calendarEventRequest(event) {
  const schedule = eventSchedule(event);
  const date = scheduleAnchor(schedule);
  const allDay = !event.start && !event.end;
  const lastDate = schedule.mode === 'range' ? schedule.endDate : date;
  const endDate =
    allDay || event.endNextDay ? shiftDate(lastDate, 1) : lastDate;
  return {
    title: event.title.trim(),
    kind: event.kind,
    notes: event.notes.trim(),
    allDay,
    startAt: `${date}T${allDay ? '00:00' : event.start}:00`,
    endAt: `${endDate}T${allDay ? '00:00' : event.end}:00`,
    schedule: {
      mode: schedule.mode,
      ...(schedule.mode === 'multiple'
        ? { dates: [...schedule.dates].sort() }
        : {}),
      ...(schedule.mode === 'repeat'
        ? {
            frequency: schedule.frequency,
            ...(schedule.frequency === 'weekly'
              ? { weekdays: schedule.weekdays }
              : {}),
            ...(schedule.endDate ? { until: schedule.endDate } : {}),
          }
        : {}),
    },
  };
}

export function calendarEventFromResponse(event) {
  const date = event.startAt.slice(0, 10);
  const endsAtMidnight = event.endAt.slice(11, 19) === '00:00:00';
  const lastDate = endsAtMidnight
    ? shiftDate(event.endAt.slice(0, 10), -1)
    : event.endAt.slice(0, 10);
  const schedule = event.schedule;
  return {
    ...event,
    date,
    start: event.allDay ? '' : event.startAt.slice(11, 16),
    end: event.allDay ? '' : event.endAt.slice(11, 16),
    endNextDay:
      !event.allDay &&
      (schedule.mode === 'range'
        ? endsAtMidnight
        : event.endAt.slice(0, 10) > date),
    schedule:
      schedule.mode === 'multiple'
        ? { mode: 'multiple', dates: schedule.dates }
        : {
            mode: schedule.mode,
            startDate: date,
            ...(schedule.mode === 'range' ? { endDate: lastDate } : {}),
            ...(schedule.mode === 'repeat'
              ? {
                  frequency: schedule.frequency,
                  endDate: schedule.until || '',
                  ...(schedule.frequency === 'weekly'
                    ? { weekdays: schedule.weekdays }
                    : {}),
                }
              : {}),
          },
  };
}

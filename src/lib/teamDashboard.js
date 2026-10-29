import { apiTimeToEpoch } from './koreanTime.js';
import { calendarDays, dateKey, isValidDate, shiftDate } from './dateTime.js';
import { validateSchedule } from './calendarSchedule.js';

export const dashboardWidgets = [
  {
    id: 'calendar',
    title: '캘린더',
    description: '직접 등록하는 우리 팀 일정',
    icon: 'calendar',
  },
  {
    id: 'progress',
    title: '팀 전체 진행률',
    description: '현재 작업의 예상 작업량 기준 진행률',
    icon: 'chart',
  },
  {
    id: 'contribution',
    title: '내 기여도',
    description: '공개된 리포트의 내 종합점수',
    icon: 'chart',
  },
  {
    id: 'attention',
    title: '지금 확인할 작업',
    description: '내 마감 지연과 7일 안에 다가오는 작업',
    icon: 'clock',
  },
  {
    id: 'upcoming',
    title: '다가오는 작업',
    description: '마감이 가까운 내 작업을 차례대로',
    icon: 'calendar',
  },
  {
    id: 'mywork',
    title: '내 작업 현황',
    description: '내 담당 비중·완료 비중·작업 완료율',
    icon: 'chart',
  },
  {
    id: 'evaluation',
    title: '동료 평가 작성',
    description: '함께한 동료에게 협업 피드백 남기기',
    icon: 'review',
  },
  {
    id: 'report',
    title: '리포트 보기',
    description: '공개된 우리 팀 기여도 리포트 확인',
    icon: 'file',
  },
  {
    id: 'members',
    title: '우리 팀',
    description: '함께하는 팀원과 팀 리더',
    icon: 'team',
  },
  {
    id: 'memo',
    title: '빠른 메모',
    description: '잊지 않을 아이디어와 회의 메모',
    icon: 'feedback',
  },
  {
    id: 'status',
    title: '작업 상태 요약',
    description: '팀 작업의 상태를 한눈에 확인',
    icon: 'board',
  },
];
export const eventKinds = {
  meeting: '회의',
  milestone: '주요 일정',
  work: '작업',
  review: '리뷰',
  other: '기타',
};
export function calendarMonthDays(year, month, weeks) {
  const days = calendarDays(year, month);
  const offset = days.findIndex((day) => day === 1);
  const first = dateKey(year, month, 1);
  return Array.from(
    { length: (weeks || Math.ceil(days.length / 7)) * 7 },
    (_, index) => {
      const date = shiftDate(first, index - offset);
      return isValidDate(date) ? date : null;
    },
  );
}
export function calendarRelativeDay(date, today) {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
  return days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}
export const defaultDashboardWidgets = ['calendar', 'progress', 'contribution'];
export function validateCalendarEvent(event) {
  if (typeof event.title !== 'string' || !event.title.trim())
    return '일정 이름을 입력해 주세요.';
  if (event.title.trim().length > 80)
    return '일정 이름은 80자 이내로 입력해 주세요.';
  if (!isValidDate(event.date)) return '올바른 날짜를 선택해 주세요.';
  if (event.schedule) {
    const error = validateSchedule(event.schedule);
    if (error) return error;
  }
  if (!Object.hasOwn(eventKinds, event.kind))
    return '일정 종류를 선택해 주세요.';
  if (event.start || event.end) {
    if (
      typeof event.start !== 'string' ||
      typeof event.end !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.start || '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.end || '')
    )
      return '시작과 종료 시간을 함께 입력해 주세요.';
    const schedule = event.schedule;
    const spansDays =
      schedule?.mode === 'range' && schedule.endDate > schedule.startDate;
    if (!spansDays && !event.endNextDay && event.end <= event.start)
      return '종료 시간은 시작 시간보다 늦어야 합니다.';
    if (
      schedule?.mode !== 'range' &&
      event.endNextDay &&
      event.end > event.start
    )
      return '일반·반복·다중 일정은 24시간 이내로 설정해 주세요.';
  }
  return '';
}
export function taskOverview(tasks, userId, now = Date.now()) {
  const mine = tasks.filter(
    (task) =>
      task.assignees?.some((entry) => entry.userId === userId) &&
      task.status !== 'DONE',
  );
  const overdue = mine.filter((task) => apiTimeToEpoch(task.dueAt) < now);
  const upcoming = mine
    .filter((task) => apiTimeToEpoch(task.dueAt) >= now)
    .sort((a, b) => apiTimeToEpoch(a.dueAt) - apiTimeToEpoch(b.dueAt));
  return {
    overdue,
    upcoming,
    soon: upcoming.filter(
      (task) => apiTimeToEpoch(task.dueAt) <= now + 7 * 86400000,
    ),
  };
}

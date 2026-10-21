import { MockError } from './planned.js';
import { koreanDateTime } from '../lib/koreanTime.js';
import {
  defaultDashboardWidgets,
  dashboardWidgets,
  validateCalendarEvent,
} from '../lib/teamDashboard.js';
import { calendarEventFromResponse } from '../lib/calendarEventContract.js';
import { eventOccursOn } from '../lib/calendarSchedule.js';
import { isValidDate, shiftDate } from '../lib/dateTime.js';

export function previewTeamHome(context, state, parts, url, method, body) {
  const byTeam = parts[1] === 'teams';
  const event =
    !byTeam &&
    (state.calendarEvents || []).find((event) => event.id === Number(parts[2]));
  const teamId = byTeam ? Number(parts[2]) : event?.teamId;
  if (!byTeam && !event)
    throw new MockError(
      'CALENDAR_EVENT_NOT_FOUND',
      '일정을 찾을 수 없습니다.',
      404,
    );
  const entry = state.teams[teamId];
  if (!entry)
    throw new MockError('TEAM_NOT_FOUND', '팀을 찾을 수 없습니다.', 404);
  if (!entry.members.some((member) => member.userId === context.user.id))
    throw new MockError('FORBIDDEN', '현재 팀원만 이용할 수 있습니다.', 403);
  if (byTeam && parts[3] === 'home-preferences') {
    state.homePreferences ||= {};
    const key = `${teamId}:${context.user.id}`;
    const current = state.homePreferences[key] || {
      teamId,
      widgets: [...defaultDashboardWidgets],
      memo: '',
    };
    if (method === 'GET') return current;
    if (method !== 'PATCH')
      throw new MockError('NOT_FOUND', '지원하지 않는 API입니다.', 404);
    const invalidWidgets =
      body.widgets !== undefined &&
      (!Array.isArray(body.widgets) ||
        body.widgets.length > dashboardWidgets.length ||
        new Set(body.widgets).size !== body.widgets.length ||
        body.widgets.some(
          (id) => !dashboardWidgets.some((widget) => widget.id === id),
        ));
    if (
      invalidWidgets ||
      (body.memo !== undefined &&
        (typeof body.memo !== 'string' || body.memo.length > 3000)) ||
      (body.widgets === undefined && body.memo === undefined)
    )
      throw new MockError(
        'INVALID_REQUEST',
        '홈 설정 값을 확인해 주세요.',
        400,
      );
    const updated = {
      ...current,
      ...(body.widgets !== undefined ? { widgets: body.widgets } : {}),
      ...(body.memo !== undefined ? { memo: body.memo } : {}),
    };
    state.homePreferences[key] = updated;
    return updated;
  }
  if (byTeam && method === 'GET') {
    const from = url.searchParams.get('from'),
      to = url.searchParams.get('to');
    if (
      !isValidDate(from) ||
      !isValidDate(to) ||
      to < from ||
      (Date.parse(to) - Date.parse(from)) / 86400000 >= 62
    )
      throw new MockError(
        'INVALID_REQUEST',
        '조회 기간은 최대 62일입니다.',
        400,
      );
    return (state.calendarEvents || []).filter((record) => {
      if (record.teamId !== teamId) return false;
      const normalized = calendarEventFromResponse(record);
      for (
        let date = from;
        isValidDate(date) && date <= to;
        date = shiftDate(date, 1)
      )
        if (eventOccursOn(normalized, date)) return true;
      return false;
    });
  }
  if (
    entry.team.workFrozen ||
    (state.deletion?.teamId === teamId && state.deletion.workFrozen)
  )
    throw new MockError(
      'TEAM_DELETION_IN_PROGRESS',
      '팀 삭제 동의 중에는 일정을 변경할 수 없습니다.',
    );
  if (
    !byTeam &&
    Number(
      method === 'DELETE'
        ? url.searchParams.get('expectedVersion')
        : body.expectedVersion,
    ) !== event.version
  )
    throw new MockError(
      'CALENDAR_EVENT_VERSION_CONFLICT',
      '최신 일정을 조회한 후 다시 시도해주세요.',
    );
  if (method === 'DELETE') {
    state.calendarEvents = state.calendarEvents.filter(
      (record) => record.id !== event.id,
    );
    return null;
  }
  if ((byTeam && method !== 'POST') || (!byTeam && method !== 'PATCH'))
    throw new MockError('NOT_FOUND', '지원하지 않는 API입니다.', 404);
  const record = {
    ...body,
    id:
      event?.id ??
      Math.max(0, ...(state.calendarEvents || []).map((item) => item.id)) + 1,
    teamId,
    authorId: event?.authorId || context.user.id,
    version: event ? event.version + 1 : 0,
    createdAt: event?.createdAt || koreanDateTime(),
    updatedAt: koreanDateTime(),
  };
  delete record.expectedVersion;
  const error = validateCalendarEvent(calendarEventFromResponse(record));
  if (error) throw new MockError('INVALID_REQUEST', error, 400);
  state.calendarEvents = [
    ...(state.calendarEvents || []).filter((item) => item.id !== record.id),
    record,
  ];
  return record;
}

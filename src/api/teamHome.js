import { apiRequest } from './client.js';

export const listCalendarEvents = (teamId, from, to) =>
  apiRequest(
    `/api/teams/${teamId}/calendar-events?${new URLSearchParams({ from, to })}`,
  );
export const createCalendarEvent = (teamId, body) =>
  apiRequest(`/api/teams/${teamId}/calendar-events`, { method: 'POST', body });
export const updateCalendarEvent = (eventId, body) =>
  apiRequest(`/api/calendar-events/${eventId}`, { method: 'PATCH', body });
export const deleteCalendarEvent = (eventId, expectedVersion) =>
  apiRequest(
    `/api/calendar-events/${eventId}?${new URLSearchParams({ expectedVersion })}`,
    { method: 'DELETE' },
  );
export const getHomePreferences = (teamId) =>
  apiRequest(`/api/teams/${teamId}/home-preferences/me`);
export const updateHomePreferences = (teamId, body) =>
  apiRequest(`/api/teams/${teamId}/home-preferences/me`, {
    method: 'PATCH',
    body,
  });

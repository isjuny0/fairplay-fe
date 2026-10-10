import { plannedRequest } from '../mock/planned.js';
import { isPreviewPath, previewContext } from '../mock/preview.js';

// main에 없는 API만 명시적으로 목업에 연결한다. 서버 오류를 목업으로 대체하지 않는다.
export function requestPlanned(context, path, options) {
  const preview = globalThis.window && isPreviewPath(window.location.pathname);
  return plannedRequest(
    preview ? { ...previewContext(), ...context, preview: true } : context,
    path,
    options,
  );
}
export const getMyWorkSummary = (context) =>
  requestPlanned(context, `/api/teams/${context.team.id}/my-work-summary`);
export const getRounds = (context) =>
  requestPlanned(context, `/api/spaces/${context.space.id}/evaluation-rounds`);
export const getMidFeedback = (context) =>
  requestPlanned(context, `/api/teams/${context.team.id}/mid-feedback`);
export const getTeamReport = (context) =>
  requestPlanned(context, `/api/teams/${context.team.id}/report`);
export const getReport = (context, id) =>
  requestPlanned(context, `/api/reports/${id}`);

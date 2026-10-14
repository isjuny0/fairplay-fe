import { plannedRequest } from '../mock/planned.js';
import { isPreviewPath, previewContext } from '../mock/preview.js';

// 미구현 리포트·관리자 수행 상세 화면의 예시 흐름만 사용한다. 실제 연동 화면에서 서버 오류를 목업으로 대체하지 않는다.
export function requestPlanned(context, path, options) {
  const preview = globalThis.window && isPreviewPath(window.location.pathname);
  return plannedRequest(
    preview ? { ...previewContext(), ...context, preview: true } : context,
    path,
    options,
  );
}
export const getRounds = (context) =>
  requestPlanned(context, `/api/spaces/${context.space.id}/evaluation-rounds`);
export const getMidFeedback = (context) =>
  requestPlanned(context, `/api/teams/${context.team.id}/mid-feedback`);
export const getTeamReport = (context) =>
  requestPlanned(context, `/api/teams/${context.team.id}/report`);

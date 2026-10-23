import { apiRequest, ApiError } from './client.js';
import { isPreviewPath } from '../lib/previewPath.js';

/**
 * Proposed source response: { teamId, deliverableId, deliverableVersion, title, type, content }.
 * content is the full normalized text whose line numbers match the question references.
 * Proposed reindex response (202): { deliverableId, deliverableVersion, title, status: 'PREPARING', failureCode: null }.
 * Both require current approved team membership and a matching expectedVersion.
 */
// Proposed contracts only. Never send an unimplemented request or fabricate live source content.
export const plannedRagApis = {
  source: {
    method: 'GET',
    path: '/api/teams/{teamId}/rag/sources/{deliverableId}?expectedVersion={version}',
    purpose: '현재 자료 버전 확인 후 검색에 사용한 텍스트 원문 조회',
  },
  reindex: {
    method: 'POST',
    path: '/api/teams/{teamId}/rag/sources/{deliverableId}/reindex',
    purpose: '재처리 가능한 실패 자료를 검색 준비 상태로 예약',
  },
};
export const canUseRagMockApis = () =>
  isPreviewPath(globalThis.window?.location?.pathname || '');
function requirePreview() {
  if (!canUseRagMockApis())
    throw new ApiError(501, {
      code: 'RAG_API_NOT_IMPLEMENTED',
      message:
        '백엔드 연동 예정 기능입니다. 답변에 포함된 인용문은 확인할 수 있습니다.',
    });
}
export function getRagSource(teamId, deliverableId, expectedVersion) {
  requirePreview();
  return apiRequest(
    `/api/teams/${teamId}/rag/sources/${deliverableId}?${new URLSearchParams({ expectedVersion })}`,
  );
}
export function retryRagSource(teamId, deliverableId, expectedVersion) {
  requirePreview();
  return apiRequest(
    `/api/teams/${teamId}/rag/sources/${deliverableId}/reindex`,
    {
      method: 'POST',
      body: { expectedVersion },
    },
  );
}

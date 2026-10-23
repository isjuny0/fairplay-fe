export const ragStatusLabels = {
  READY: '검색 가능',
  PREPARING: '준비 중',
  FAILED: '준비 실패',
  UNSUPPORTED: '지원하지 않는 형식',
};
export const ragFailureLabels = {
  DOCUMENT_LIMIT_EXCEEDED: '자료의 크기 또는 길이가 처리 한도를 넘었습니다.',
  INVALID_TEXT: 'UTF-8 텍스트인지 확인해 주세요.',
  EMPTY_TEXT: '본문에 검색할 내용이 없습니다.',
  UPSTREAM_UNAVAILABLE: '자료 준비 서비스에 연결하지 못했습니다.',
  INDEX_TIMEOUT: '자료 준비 시간이 초과되었습니다.',
  INDEX_INTERRUPTED: '자료 준비가 중단되었습니다.',
  INVALID_EMBEDDING_RESPONSE: '자료 준비 결과를 확인하지 못했습니다.',
};
export const retryableRagFailures = new Set([
  'UPSTREAM_UNAVAILABLE',
  'INDEX_TIMEOUT',
  'INDEX_INTERRUPTED',
  'INVALID_EMBEDDING_RESPONSE',
]);
export function canRetryRagSource(item) {
  return item.status === 'FAILED' && retryableRagFailures.has(item.failureCode);
}
export const ragExamples = [
  '회원 탈퇴 시 작성한 게시글은 어떻게 처리하기로 했지?',
  '사용자 테스트에서 확인한 주요 개선점은 무엇이야?',
  '이번 프로젝트에서 합의한 기능 범위를 알려줘.',
];
export function ragQuestionError(question) {
  if (!question.trim()) return '팀 자료에서 찾고 싶은 내용을 입력해 주세요.';
  return question.trim().length > 1000
    ? '질문은 1,000자 이내로 입력해 주세요.'
    : '';
}
export function ragErrorGuidance(error) {
  return (
    {
      RAG_SOURCE_CHANGED:
        '답변을 준비하는 동안 자료가 변경되었습니다. 최신 자료를 기준으로 다시 질문해 주세요.',
      RAG_CONTEXT_TOO_LARGE:
        '관련 자료가 너무 많습니다. 기능명이나 확인할 정책을 구체적으로 적어 주세요.',
      RAG_IN_PROGRESS:
        '이미 처리 중인 질문이 있습니다. 잠시 후 다시 질문해 주세요.',
      RAG_RATE_LIMITED: '질문 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      RAG_BUSY: '현재 질문 처리가 혼잡합니다. 잠시 후 다시 시도해 주세요.',
      RAG_INVALID_RESPONSE:
        '자료에 근거한 답변을 확인하지 못했습니다. 질문을 구체적으로 바꿔 보세요.',
      RAG_TIMEOUT:
        '응답을 기다리는 시간이 길어졌습니다. 입력한 질문은 유지됩니다. 다시 시도해 주세요.',
      RAG_UNAVAILABLE:
        '현재 자료 질문 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    }[error?.code] ||
    error?.message ||
    '요청을 처리하지 못했습니다.'
  );
}
export const noEvidenceMessage = (reason) =>
  ({
    NO_READY_SOURCES:
      '검색 준비가 끝난 자료가 없습니다. 자료 준비 현황을 확인해 주세요.',
    NO_RELEVANT_SOURCES:
      '질문과 관련된 근거를 찾지 못했습니다. 기능명이나 문서 내용을 구체적으로 적어 보세요.',
    NO_EVIDENCE: '등록된 자료만으로는 답변을 뒷받침할 수 없습니다.',
  })[reason] || '등록된 자료에서 확인할 수 없습니다.';
export function sourceLocation(reference) {
  return `${reference.headingPath?.join(' › ') || '본문'} · ${reference.startLine}–${reference.endLine}행`;
}

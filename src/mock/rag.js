import { MockError } from './planned.js';
import { canRetryRagSource } from '../lib/rag.js';

const fail = (code, message, status = 409) => {
  throw new MockError(code, message, status);
};
function materialItems(entry, state) {
  return entry.deliverables.map((item, index) => {
    const supported =
      item.type === 'TEXT' ||
      /\.(txt|md)$/i.test(item.file?.originalFilename || '');
    const override = state.ragIndexOverrides?.[item.id];
    const currentOverride =
      override?.deliverableVersion === item.version ? override : null;
    return {
      deliverableId: item.id,
      deliverableVersion: item.version,
      title: item.title,
      status: !supported
        ? 'UNSUPPORTED'
        : currentOverride?.status ||
          (state.ragScenario === 'preparing'
            ? 'PREPARING'
            : state.ragScenario === 'failed' && index === 1
              ? 'FAILED'
              : item.type === 'FILE'
                ? 'PREPARING'
                : 'READY'),
      failureCode:
        supported &&
        !currentOverride &&
        state.ragScenario === 'failed' &&
        index === 1
          ? 'UPSTREAM_UNAVAILABLE'
          : null,
    };
  });
}
export function previewRag(context, state, parts, url, method, body) {
  const teamId = Number(parts[2]),
    entry = state.teams[teamId];
  if (!entry) fail('TEAM_NOT_FOUND', '팀을 찾을 수 없습니다.', 404);
  if (!entry.members.some((member) => member.userId === context.user.id))
    fail('FORBIDDEN', '현재 팀원만 자료를 검색할 수 있습니다.', 403);
  const items = materialItems(entry, state),
    enabled = state.ragScenario !== 'disabled';
  if (parts[4] === 'index-status' && method === 'GET') {
    const page = Number(url.searchParams.get('page') ?? 0),
      size = Number(url.searchParams.get('size') ?? 20);
    if (
      !Number.isSafeInteger(page) ||
      page < 0 ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > 100
    )
      fail('INVALID_REQUEST', '페이지 범위를 확인해 주세요.', 400);
    return {
      teamId,
      enabled,
      readyCount: items.filter((item) => item.status === 'READY').length,
      preparingCount: items.filter((item) => item.status === 'PREPARING')
        .length,
      failedCount: items.filter((item) => item.status === 'FAILED').length,
      unsupportedCount: items.filter((item) => item.status === 'UNSUPPORTED')
        .length,
      page,
      size,
      totalElements: items.length,
      items: items.slice(page * size, (page + 1) * size),
    };
  }
  if (parts[4] === 'questions' && method === 'POST') {
    if (!enabled)
      fail('RAG_UNAVAILABLE', '자료 질문 기능을 현재 사용할 수 없습니다.', 503);
    if (
      typeof body.question !== 'string' ||
      !body.question.trim() ||
      body.question.trim().length > 1000
    )
      fail('INVALID_REQUEST', '질문은 1~1,000자로 입력해 주세요.', 400);
    const ready = items.filter((item) => item.status === 'READY');
    const unavailable = (reason) => ({
      teamId,
      answerable: false,
      reason,
      answer: '등록된 자료에서 확인할 수 없습니다',
      references: [],
      limitations: [],
    });
    if (!ready.length) return unavailable('NO_READY_SOURCES');
    if (state.ragScenario === 'no-evidence')
      return unavailable('NO_RELEVANT_SOURCES');
    const term = body.question.includes('인터뷰')
      ? '인터뷰'
      : body.question.includes('설문')
        ? '설문'
        : '프로젝트';
    const selected =
      ready.find((item) => item.title.includes(term)) || ready[0];
    const document = entry.deliverables.find(
      (item) => item.id === selected.deliverableId,
    );
    const lines = document.text.split('\n');
    const quote = lines[0].slice(0, 300);
    return {
      teamId,
      answerable: true,
      reason: null,
      answer: `**${document.title}**에서 다음 내용을 확인할 수 있습니다.\n\n${document.text}`,
      references: [
        {
          sourceId: `source-${document.id}`,
          deliverableId: document.id,
          deliverableVersion: document.version,
          title: document.title,
          type: document.type,
          sourceUrl: `/api/teams/${teamId}/deliverables`,
          headingPath: [],
          startLine: 1,
          endLine: lines.length,
          quote,
        },
      ],
      limitations: ['미리보기 응답 예시이며 실제 AI가 생성한 답변이 아닙니다.'],
    };
  }
  if (parts[4] === 'sources') {
    const deliverableId = Number(parts[5]),
      document = entry.deliverables.find((item) => item.id === deliverableId);
    if (!document)
      fail('DELIVERABLE_NOT_FOUND', '자료를 찾을 수 없습니다.', 404);
    const version =
      method === 'GET'
        ? Number(url.searchParams.get('expectedVersion'))
        : body.expectedVersion;
    if (version !== document.version)
      fail('RAG_SOURCE_CHANGED', '자료가 변경되었습니다. 다시 질문해주세요.');
    if (method === 'POST' && parts[6] === 'reindex') {
      if (!enabled)
        fail(
          'RAG_UNAVAILABLE',
          '자료 질문 기능을 현재 사용할 수 없습니다.',
          503,
        );
      const item = items.find((item) => item.deliverableId === deliverableId);
      if (!canRetryRagSource(item))
        fail('RAG_REINDEX_NOT_ALLOWED', '재시도 가능한 실패 상태가 아닙니다.');
      state.ragIndexOverrides ||= {};
      state.ragIndexOverrides[deliverableId] = {
        deliverableVersion: version,
        status: 'PREPARING',
      };
      return { ...item, status: 'PREPARING', failureCode: null };
    }
    if (method === 'GET' && parts.length === 6) {
      if (document.type !== 'TEXT')
        fail(
          'RAG_SOURCE_UNSUPPORTED',
          '이 예시 자료의 원문은 파일 다운로드로 확인해 주세요.',
          415,
        );
      return {
        teamId,
        deliverableId,
        deliverableVersion: version,
        title: document.title,
        type: document.type,
        content: document.text,
      };
    }
  }
  fail('NOT_FOUND', '지원하지 않는 자료 검색 API입니다.', 404);
}

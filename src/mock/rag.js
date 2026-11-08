import { MockError } from './planned.js';
import { previewRagFile } from './ragFiles.js';

const projectTopics = [
  [/마감 (시점|집계|기준)|중간 평가|중간 피드백/, '중간 평가 마감 집계 기준'],
  [/인계|탈퇴/, '팀 탈퇴와 작업 인계 검증 시나리오'],
  [/타임라인|담당자 아이콘/, '작업 타임라인 화면 점검표'],
  [/AI\s*(검토|피드백)|재검토/i, 'AI 검토 응답 점검 기록'],
  [/재순위화|벡터 검색/, '팀 자료 검색 재순위화 점검표'],
  [/리포트 공개|평가 비중|종합점수/, '리포트 생성·공개 확인 순서'],
];

const fail = (code, message, status = 409) => {
  throw new MockError(code, message, status);
};
function materialItems(entry, state) {
  return entry.deliverables.map((item, index) => {
    const supported =
      item.type === 'TEXT' ||
      /\.(txt|md|pdf|docx)$/i.test(item.file?.originalFilename || '');
    return {
      deliverableId: item.id,
      deliverableVersion: item.version,
      title: item.title,
      status: !supported
        ? 'UNSUPPORTED'
        : state.ragScenario === 'preparing'
          ? 'PREPARING'
          : state.ragScenario === 'failed' && index === 1
            ? 'FAILED'
            : item.type === 'FILE' && !previewRagFile(item)
              ? 'PREPARING'
              : 'READY',
      failureCode:
        supported && state.ragScenario === 'failed' && index === 1
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
    const term = /권한|참여 코드|팀 가입|결정/.test(body.question)
      ? '권한'
      : /검색|인용|원문/.test(body.question)
        ? '검색'
        : '프로젝트';
    const projectTitle = state.projectRecordsAt
      ? projectTopics.find(([pattern]) => pattern.test(body.question))?.[1]
      : undefined;
    const sampleFormat = /pdf|피디에프/i.test(body.question) ? 'pdf'
      : /docx|word|워드/i.test(body.question) ? 'docx' : null;
    const sampleId = sampleFormat
      ? entry.deliverables.find((item) => item.ragSampleFormat === sampleFormat)?.id : null;
    const selected =
      ready.find((item) => item.deliverableId === sampleId) ||
      (projectTitle && ready.find((item) => item.title === projectTitle)) ||
      ready.find((item) => item.title.includes(term)) || ready[0];
    const document = entry.deliverables.find(
      (item) => item.id === selected.deliverableId,
    );
    const sample = previewRagFile(document);
    const pageNumber = sample?.pages?.length ?? null;
    const content = pageNumber == null ? sample?.content ?? document.text : sample.pages[pageNumber - 1];
    const lines = content.split('\n');
    const startLine = sample ? 2 : 1;
    const quote = lines[startLine - 1].slice(0, 300);
    return {
      teamId,
      answerable: true,
      reason: null,
      answer: `**${document.title}**에서 다음 내용을 확인할 수 있습니다.\n\n${content}`,
      references: [
        {
          sourceId: `source-${document.id}`,
          deliverableId: document.id,
          deliverableVersion: document.version,
          title: document.title,
          type: document.type,
          sourceUrl: `/api/teams/${teamId}/deliverables`,
          headingPath: [],
          startLine,
          endLine: lines.length,
          pageNumber,
          quote,
        },
      ],
      limitations: [],
    };
  }
  if (parts[4] === 'sources' && method === 'GET' && parts.length === 6) {
    const deliverableId = Number(parts[5]),
      document = entry.deliverables.find((item) => item.id === deliverableId);
    if (!document)
      fail('DELIVERABLE_NOT_FOUND', '자료를 찾을 수 없습니다.', 404);
    const version = Number(url.searchParams.get('expectedVersion'));
    if (version !== document.version)
      fail('RAG_SOURCE_CHANGED', '자료가 변경되었습니다. 다시 질문해주세요.');
    const sample = previewRagFile(document);
    const requestedPage = url.searchParams.get('pageNumber');
    if (requestedPage != null && (!sample?.pages || !/^[1-9]\d*$/.test(requestedPage)))
      fail('INVALID_REQUEST', '페이지 번호를 확인해 주세요.', 400);
    const pageNumber = sample?.pages ? Number(requestedPage ?? 1) : null;
    if (sample?.pages && !sample.pages[pageNumber - 1])
      fail('RAG_SOURCE_PAGE_NOT_FOUND', '해당 PDF 페이지에서 추출한 텍스트를 찾을 수 없습니다.', 404);
    if (document.type !== 'TEXT' && !sample)
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
      content: sample?.pages ? sample.pages[pageNumber - 1] : sample?.content ?? document.text,
      pageNumber,
    };
  }
  fail('NOT_FOUND', '지원하지 않는 자료 검색 API입니다.', 404);
}

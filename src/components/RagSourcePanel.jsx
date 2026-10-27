import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import useResource from '../hooks/useResource.js';
import { getRagSource } from '../api/rag.js';
import { sourceLocation, ragSourceErrorGuidance } from '../lib/rag.js';
import { ErrorNotice } from './ui.jsx';

export default function RagSourcePanel({
  teamId,
  reference,
  onAccessError,
  onBack,
  onDismiss,
  onOpenMaterials,
}) {
  const panel = useRef(null);
  const guide = usePreviewGuide();
  const guidedSource = guide?.guiding && guide.scenarioId === 'materials-search' && guide.stepId === 'materials-source';
  const hasCitation = Number.isInteger(reference.startLine) &&
    Number.isInteger(reference.endLine) && reference.startLine >= 1 &&
    reference.endLine >= reference.startLine;
  const originalFocus = useRef(document.activeElement);
  const original = useRef(null);
  const resource = useResource(
    () => getRagSource(
      teamId, reference.deliverableId, reference.deliverableVersion,
    ),
    [teamId, reference.deliverableId, reference.deliverableVersion],
  );
  useEffect(() => {
    if (resource.error?.status === 403) onAccessError(resource.error);
  }, [resource.error, onAccessError]);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    return () => originalFocus.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const element = panel.current?.querySelector(
      '[data-source-highlight="true"]',
    );
    if (element && original.current) {
      original.current.scrollTop +=
        element.getBoundingClientRect().top -
        original.current.getBoundingClientRect().top - 16;
    }
  }, [resource.data]);
  const content = resource.data;
  const matchesSource =
    content?.teamId === teamId &&
    content?.deliverableId === reference.deliverableId &&
    content?.deliverableVersion === reference.deliverableVersion &&
    ['TEXT', 'FILE'].includes(content?.type) &&
    (reference.type == null || content?.type === reference.type) &&
    typeof content?.title === 'string' &&
    typeof content?.content === 'string';
  const reportSource = guide?.setMaterialsSource;
  const sourceReady = Boolean(matchesSource && hasCitation && !resource.loading && !resource.error
    && reference.endLine <= content.content.split('\n').length);
  useEffect(() => {
    if (!guidedSource) return;
    reportSource({ ready: sourceReady, loading: resource.loading, error: Boolean(resource.error), teamId, deliverableId: reference.deliverableId,
      deliverableVersion: reference.deliverableVersion, startLine: reference.startLine, endLine: reference.endLine });
    return () => reportSource(null);
  }, [guidedSource, reportSource, sourceReady, resource.loading, resource.error, teamId, reference.deliverableId, reference.deliverableVersion, reference.startLine, reference.endLine]);
  return (
    <aside
      className="rag-source-panel"
      role="region"
      aria-label={hasCitation ? '근거 원문' : '자료 원문'}
      ref={panel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onBack();
        }
      }}
    >
      <header className="rag-panel-heading">
        <button className="rag-inline-link rag-back-to-list" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          자료 목록
        </button>
        <button
          type="button"
          className="icon-button rag-mobile-panel-close"
          aria-label="자료 패널 닫기"
          onClick={onDismiss}
        >
          <X size={18} />
        </button>
      </header>
      <div className="rag-source-meta">
        <h2>{reference.title}</h2>
        <p>{hasCitation ? sourceLocation(reference) : '전체 원문'}</p>
      </div>
      {resource.loading ? (
        <p className="rag-source-message" role="status">
          원문을 불러오는 중…
        </p>
      ) : resource.error ? (
        <ErrorNotice
          error={{
            status: resource.error.status,
            code: resource.error.code,
            message: ragSourceErrorGuidance(resource.error),
          }}
          onRetry={
            [401, 403, 404, 409, 413, 415, 422].includes(resource.error.status)
              ? undefined
              : resource.reload
          }
        />
      ) : !matchesSource ? (
        <p className="rag-source-message" role="alert">
          요청한 자료와 원문 정보가 일치하지 않습니다. 최신 자료를 기준으로
          다시 질문해 주세요.
        </p>
      ) : (
        <div
          className="rag-original"
          role="region"
          aria-label="줄 번호가 있는 원문"
          tabIndex={0}
          ref={original}
        >
          {content.content.split('\n').map((line, index) => (
            <div
              className="rag-original-line"
              key={index}
              data-source-highlight={
                hasCitation && index + 1 >= reference.startLine && index + 1 <= reference.endLine
              }
            >
              <span aria-hidden="true">{index + 1}</span>
              <code>{line || ' '}</code>
            </div>
          ))}
        </div>
      )}
      <footer>
        {guidedSource && <button className="primary-button" data-guide="confirm-material-source"
          disabled={!sourceReady} onClick={() => guide.confirmMaterialsStep('materials-source')}>원문 확인 완료</button>}
        <button className="secondary-button" onClick={onOpenMaterials}>
          산출물에서 찾기
          <ArrowUpRight size={15} />
        </button>
      </footer>
    </aside>
  );
}

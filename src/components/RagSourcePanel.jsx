import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Download, X } from 'lucide-react';
import useResource from '../hooks/useResource.js';
import { getRagSource } from '../api/rag.js';
import { downloadRagSourceFile } from '../api/deliverables.js';
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
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const guide = usePreviewGuide();
  const guidedSource = guide?.guiding && guide.scenarioId === 'materials-search' && guide.stepId === 'materials-source';
  const hasCitation = Number.isInteger(reference.startLine) &&
    Number.isInteger(reference.endLine) && reference.startLine >= 1 &&
    reference.endLine >= reference.startLine;
  const originalFocus = useRef(document.activeElement);
  const original = useRef(null);
  const resource = useResource(
    () => getRagSource(
      teamId, reference.deliverableId, reference.deliverableVersion, reference.pageNumber,
    ),
    [teamId, reference.deliverableId, reference.deliverableVersion, reference.pageNumber],
  );
  useEffect(() => {
    if ([401, 403].includes(resource.error?.status)) onAccessError(resource.error);
  }, [resource.error, onAccessError]);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => originalFocus.current?.focus({ preventScroll: true }));
    };
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
    (reference.pageNumber == null || content?.pageNumber === reference.pageNumber) &&
    ['TEXT', 'FILE'].includes(content?.type) &&
    (reference.type == null || content?.type === reference.type) &&
    typeof content?.title === 'string' &&
    typeof content?.content === 'string';
  const reportSource = guide?.setMaterialsSource;
  const sourceReady = Boolean(matchesSource && hasCitation && !resource.loading && !resource.error
    && reference.endLine <= content.content.split('\n').length);
  const sourcePage = reference.pageNumber ?? (matchesSource ? content.pageNumber : null);
  const isFileSource = reference.type === 'FILE' || (matchesSource && content.type === 'FILE');
  const location = sourcePage != null ? sourceLocation({ pageNumber: sourcePage })
    : hasCitation ? sourceLocation(reference) : isFileSource ? '' : '전체 원문';
  const downloadOriginal = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const { blob, filename } = await downloadRagSourceFile(teamId, reference);
      if (!panel.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (!panel.current) return;
      if ([401, 403].includes(failure.status)) onAccessError(failure);
      else setDownloadError(failure.code === 'RAG_SOURCE_CHANGED' || failure.status === 404
        ? '원본 파일이 변경되었거나 삭제되었습니다. 팀 자료에서 확인해 주세요.'
        : '원본 파일을 다운로드하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (panel.current) setDownloading(false);
    }
  };
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
        <p>{[location, isFileSource && '파일에서 추출한 텍스트'].filter(Boolean).join(' · ')}</p>
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
          aria-label={sourcePage != null ? 'PDF 페이지에서 추출한 텍스트'
            : isFileSource ? '파일에서 추출한 텍스트' : '줄 번호가 있는 원문'}
          tabIndex={0}
          ref={original}
        >
          {content.content.split('\n').map((line, index) => (
            <div
              className="rag-original-line"
              key={index}
              data-source-highlight={
                sourceReady && index + 1 >= reference.startLine && index + 1 <= reference.endLine
              }
            >
              <span aria-hidden="true">{index + 1}</span>
              <code>{line || ' '}</code>
            </div>
          ))}
        </div>
      )}
      <footer>
        {downloadError && <p className="field-error rag-source-download-error" role="alert">{downloadError}</p>}
        <div className="rag-source-footer-actions">
          {guidedSource && <button className="primary-button" data-guide="confirm-material-source"
            disabled={!sourceReady} onClick={() => guide.confirmMaterialsStep('materials-source')}>원문 확인 완료</button>}
          {matchesSource && isFileSource && !resource.loading && !resource.error && (
            <button type="button" className="secondary-button" onClick={downloadOriginal} disabled={downloading}>
              <Download size={15} />
              {downloading ? '다운로드 중…' : '원본 파일 다운로드'}
            </button>
          )}
          <button className="secondary-button" onClick={onOpenMaterials}>
            팀 자료에서 찾기
            <ArrowUpRight size={15} />
          </button>
        </div>
      </footer>
    </aside>
  );
}

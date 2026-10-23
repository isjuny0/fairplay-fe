import { useEffect, useRef } from 'react';
import { ArrowUpRight, FileText, X } from 'lucide-react';
import useResource from '../hooks/useResource.js';
import { getRagSource } from '../api/ragPlanned.js';
import { sourceLocation } from '../lib/rag.js';
import { ResourceState } from './ui.jsx';

export default function RagSourcePanel({
  teamId,
  reference,
  mockAvailable,
  onClose,
  onOpenMaterials,
}) {
  const panel = useRef(null);
  const originalFocus = useRef(document.activeElement);
  const resource = useResource(async () => {
    if (!mockAvailable) return null;
    return getRagSource(
      teamId,
      reference.deliverableId,
      reference.deliverableVersion,
    );
  }, [
    teamId,
    reference.sourceId,
    reference.deliverableId,
    reference.deliverableVersion,
    mockAvailable,
  ]);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1199px)').matches)
      panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    return () => originalFocus.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const element = panel.current?.querySelector(
      '[data-source-highlight="true"]',
    );
    if (element) element.scrollIntoView({ block: 'nearest' });
  }, [resource.data]);
  const content = resource.data;
  const matchesVersion =
    content?.teamId === teamId &&
    content?.deliverableId === reference.deliverableId &&
    content?.deliverableVersion === reference.deliverableVersion;
  return (
    <aside
      className="rag-source-panel"
      role="region"
      aria-label="근거 원문"
      ref={panel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="rag-panel-heading">
        <span>
          <FileText size={16} />
          근거 원문
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="근거 원문 닫기"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="rag-source-meta">
        <h2>{reference.title}</h2>
        <p>{sourceLocation(reference)}</p>
      </div>
      <div className="rag-source-quote">
        <span className="rag-section-label">답변에 사용한 인용문</span>
        <blockquote>{reference.quote}</blockquote>
      </div>
      {mockAvailable ? (
        <>
          <p className="rag-mock-note">
            원문 조회 API 목업 · 미리보기 자료를 표시합니다.
          </p>
          <ResourceState resource={resource} label="원문">
            {content && !matchesVersion && (
              <p className="notice" role="alert">
                자료 버전이 달라 원문을 표시하지 않았습니다. 최신 자료로 다시
                질문해 주세요.
              </p>
            )}
            {content && matchesVersion && (
              <div
                className="rag-original"
                role="region"
                aria-label="줄 번호가 있는 원문"
                tabIndex={0}
              >
                {content.content.split('\n').map((line, index) => (
                  <div
                    className="rag-original-line"
                    key={index}
                    data-source-highlight={
                      index + 1 >= reference.startLine &&
                      index + 1 <= reference.endLine
                    }
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    <code>{line || ' '}</code>
                  </div>
                ))}
              </div>
            )}
          </ResourceState>
        </>
      ) : (
        <div className="rag-planned-notice">
          <strong>전체 원문 조회 연동 예정</strong>
          <p>
            현재는 답변에 포함된 인용문을 확인할 수 있습니다. 전체 원문은
            산출물에서 확인해 주세요.
          </p>
        </div>
      )}
      <footer>
        <button className="secondary-button" onClick={onOpenMaterials}>
          산출물에서 찾기
          <ArrowUpRight size={15} />
        </button>
      </footer>
    </aside>
  );
}

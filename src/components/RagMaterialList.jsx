import { usePreviewGuide } from '../lib/previewGuideContext.js';
import { useLayoutEffect, useRef } from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';
import RefreshButton from './RefreshButton.jsx';
import { ragStatusLabels, ragFailureLabels } from '../lib/rag.js';
import { ResourceState } from './ui.jsx';

export default function RagMaterialList({
  resource, page, setPage, onSelect, onDismiss, active,
}) {
  const data = resource.data;
  const guide = usePreviewGuide();
  const guidedOverview = guide?.guiding && guide.scenarioId === 'materials-search' && guide.stepId === 'materials-overview';
  const scroll = useRef(null);
  const scrollTop = useRef(0);
  useLayoutEffect(() => {
    scrollTop.current = 0;
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [page]);
  useLayoutEffect(() => {
    if (active && scroll.current) scroll.current.scrollTop = scrollTop.current;
  }, [active]);
  const changePage = (nextPage) => {
    setPage(nextPage);
    scroll.current?.closest('[data-materials-list]')?.focus({ preventScroll: true });
  };
  return (
    <section
      className="rag-material-list"
      role="region"
      aria-label="팀 자료"
      data-materials-list
      aria-busy={resource.loading}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <header className="rag-panel-heading">
        <h2>팀 자료 {data && <span>{data.totalElements.toLocaleString()}</span>}</h2>
        <div className="rag-panel-actions">
          <RefreshButton
            label="팀 자료 새로고침"
            disabled={resource.loading}
            onClick={resource.reload}
          />
          <button
            type="button"
            className="icon-button rag-mobile-panel-close"
            aria-label="자료 패널 닫기"
            onClick={onDismiss}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      {data && !resource.error && (
        <div className="rag-material-summary" aria-label="자료 준비 요약">
          <span>검색 가능 {data.readyCount.toLocaleString()}개</span>
          {data.preparingCount > 0 && <span>준비 중 {data.preparingCount.toLocaleString()}개</span>}
          {data.failedCount > 0 && <span className="rag-status-warning">실패 {data.failedCount.toLocaleString()}개</span>}
          {data.unsupportedCount > 0 && <span>미지원 {data.unsupportedCount.toLocaleString()}개</span>}
        </div>
      )}
      <div
        className="rag-material-scroll"
        ref={scroll}
        onScroll={(event) => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}
      >
        <ResourceState resource={{ ...resource, loading: resource.loading && !data }} label="팀 자료">
          {data && (data.items.length ? (
            <ul className="rag-material-items">
              {data.items.map((item) => (
                <li key={item.deliverableId}>
                  <button
                    className="rag-material-item"
                    aria-label={`${item.title} 자료 원문 보기`}
                    disabled={item.status === 'UNSUPPORTED'}
                    onClick={() => onSelect(item)}
                  >
                    <FileText size={16} aria-hidden="true" />
                    <span className="rag-material-item-body">
                      <strong>{item.title}</strong>
                      <span className={`rag-state rag-state-${item.status.toLowerCase()}`}>
                        {ragStatusLabels[item.status] || '상태 확인 필요'}
                      </span>
                      {item.status === 'UNSUPPORTED' ? (
                        <small>원문 조회를 지원하지 않는 형식입니다.</small>
                      ) : item.status === 'FAILED' ? (
                        <small>{ragFailureLabels[item.failureCode] || '자료 준비에 실패했습니다.'}</small>
                      ) : null}
                    </span>
                    {item.status !== 'UNSUPPORTED' && <ChevronRight size={15} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rag-empty-materials">
              <strong>{data.totalElements ? '이 페이지의 자료가 변경되었습니다.' : '등록된 팀 자료가 없습니다.'}</strong>
              <p>산출물에서 문서를 작성하거나 지원하는 파일을 등록해 주세요.</p>
              {page > 0 && <button className="rag-inline-link" onClick={() => changePage(0)}>첫 페이지로 이동</button>}
            </div>
          ))}
        </ResourceState>
      </div>
      {data && !resource.error && data.totalElements > data.size && (
        <nav className="rag-material-pagination" aria-label="팀 자료 페이지">
          <span>{data.page + 1} / {Math.ceil(data.totalElements / data.size)}</span>
          <div>
            <button
              className="secondary-button"
              disabled={page === 0 || resource.loading}
              onClick={() => changePage(page - 1)}
            >이전</button>
            <button
              className="secondary-button"
              disabled={(data.page + 1) * data.size >= data.totalElements || resource.loading}
              onClick={() => changePage(page + 1)}
            >다음</button>
          </div>
        </nav>
      )}
      {guidedOverview && <div className="preview-guide-inline-action">
        <button className="secondary-button" data-guide="confirm-materials-overview"
          disabled={resource.loading || Boolean(resource.error) || !data?.enabled || !data.readyCount}
          onClick={() => guide.confirmMaterialsStep('materials-overview')}>자료 확인 완료</button>
      </div>}
      <p className="rag-material-support">작성 문서·UTF-8 TXT·MD 파일을 검색합니다.</p>
    </section>
  );
}

import { RefreshCw } from 'lucide-react';
import { ragStatusLabels, ragFailureLabels } from '../lib/rag.js';
import { Modal, ResourceState } from './ui.jsx';

export default function RagIndexStatus({
  resource,
  page,
  setPage,
  onClose,
  onOpenMaterials,
}) {
  const data = resource.data;
  return (
    <Modal title="자료 준비 현황" onClose={onClose} wide>
      <div className="rag-index-intro">
        <p>
          작성한 문서와 UTF-8 TXT·MD 파일을 검색에 사용합니다. 자료를 등록하거나
          수정하면 검색을 준비합니다.
        </p>
        <button
          className="secondary-button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          <RefreshCw size={15} />
          새로고침
        </button>
      </div>
      <ResourceState resource={resource} label="자료 준비 현황">
        {data && (
          <>
            {!data.enabled && (
              <p className="notice">
                현재 자료 질문 기능이 비활성화되어 있습니다.
              </p>
            )}
            {data.items.length ? (
              <div className="rag-index-scroll">
                <table className="rag-index-table">
                  <thead>
                    <tr>
                      <th scope="col">자료</th>
                      <th scope="col">준비 상태</th>
                      <th scope="col">안내</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.deliverableId}>
                        <th scope="row">
                          <button
                            className="rag-inline-link"
                            onClick={() => onOpenMaterials(item.title)}
                          >
                            {item.title}
                          </button>
                        </th>
                        <td>
                          <span
                            className={`rag-state rag-state-${item.status.toLowerCase()}`}
                          >
                            {ragStatusLabels[item.status] || '상태 확인 필요'}
                          </span>
                        </td>
                        <td>
                          {ragFailureLabels[item.failureCode] ||
                            (item.status === 'UNSUPPORTED'
                              ? '현재 지원하는 문서·파일 형식을 확인해 주세요.'
                              : item.status === 'PREPARING'
                                ? '준비가 완료되면 질문에 반영됩니다.'
                                : '현재 버전 기준')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rag-empty-materials">
                <strong>준비 현황에 표시할 자료가 없습니다.</strong>
                <p>
                  산출물에서 문서를 작성하거나 지원하는 파일을 등록해 주세요.
                </p>
              </div>
            )}
            <div className="rag-index-pagination">
              <span>
                총 {data.totalElements.toLocaleString()}개 · {data.page + 1}
                페이지
              </span>
              <div>
                <button
                  className="secondary-button"
                  disabled={page === 0 || resource.loading}
                  onClick={() => setPage(page - 1)}
                >
                  이전
                </button>
                <button
                  className="secondary-button"
                  disabled={
                    (data.page + 1) * data.size >= data.totalElements ||
                    resource.loading
                  }
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </ResourceState>
    </Modal>
  );
}

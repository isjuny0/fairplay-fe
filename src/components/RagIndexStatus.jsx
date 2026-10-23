import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { retryRagSource } from '../api/ragPlanned.js';
import {
  ragStatusLabels,
  ragFailureLabels,
  canRetryRagSource,
} from '../lib/rag.js';
import { ErrorNotice, Modal, ResourceState } from './ui.jsx';

export default function RagIndexStatus({
  resource,
  page,
  setPage,
  teamId,
  mockAvailable,
  onClose,
  onOpenMaterials,
}) {
  const [retryingId, setRetryingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const data = resource.data;
  const retry = async (item) => {
    if (retryingId != null) return;
    setError(null);
    setNotice('');
    setRetryingId(item.deliverableId);
    try {
      await retryRagSource(teamId, item.deliverableId, item.deliverableVersion);
      setNotice(
        '목업에서 검색 준비를 예약했습니다. 실제 서버에는 요청하지 않았습니다.',
      );
      resource.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setRetryingId(null);
    }
  };
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
      <p className="rag-planned-caption">
        실패 자료의 준비 재시도는 추가 API 목업입니다.{' '}
        {mockAvailable
          ? '미리보기에서 동작을 확인할 수 있습니다.'
          : '백엔드 연동 후 사용할 수 있습니다.'}
      </p>
      <ErrorNotice error={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
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
                      <th scope="col">
                        <span className="sr-only">동작</span>
                      </th>
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
                        <td>
                          {canRetryRagSource(item) && (
                            <button
                              className="secondary-button"
                              disabled={
                                !mockAvailable ||
                                !data.enabled ||
                                retryingId != null
                              }
                              title={
                                !mockAvailable
                                  ? '준비 재시도 API 연동 예정'
                                  : undefined
                              }
                              onClick={() => retry(item)}
                            >
                              {retryingId === item.deliverableId
                                ? '예약 중…'
                                : '준비 재시도'}
                              {mockAvailable && <small>목업</small>}
                            </button>
                          )}
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
                  disabled={
                    page === 0 || resource.loading || retryingId != null
                  }
                  onClick={() => setPage(page - 1)}
                >
                  이전
                </button>
                <button
                  className="secondary-button"
                  disabled={
                    (data.page + 1) * data.size >= data.totalElements ||
                    resource.loading ||
                    retryingId != null
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

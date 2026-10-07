import { ErrorNotice } from './ui.jsx';

export default function SaveRecovery({
  error,
  recovery,
  onLoadLatest,
  rows = [],
  canReapply = true,
  restriction,
  children,
}) {
  if (!error) return null;
  const conflict = error.code === 'VERSION_CONFLICT';
  const changedRows = rows.filter((row) => row.latest !== row.input);
  return (
    <section className="save-recovery" aria-label="저장 실패 복구">
      <h3>
        {conflict
          ? '최신 내용과 비교해 다시 저장하세요'
          : '입력한 내용은 유지하고 있습니다'}
      </h3>
      <p className="field-help">
        {onLoadLatest
          ? '서버에 저장된 최신 내용을 확인해도 작성 중인 입력은 바뀌지 않습니다. 자동으로 다시 저장하지 않습니다.'
          : '요청 결과가 확인되지 않았다면 목록에서 등록 여부를 먼저 확인해 주세요. 같은 내용을 다시 등록하면 중복될 수 있습니다.'}
      </p>
      {onLoadLatest && (
        <button
          type="button"
          className="secondary-button"
          disabled={recovery.loading}
          onClick={onLoadLatest}
        >
          {recovery.loading ? '최신 내용 확인 중…' : '최신 내용 확인'}
        </button>
      )}
      <ErrorNotice error={recovery.loadError} />
      {recovery.latest && (
        <>
          {children}
          {changedRows.length ? (
            <dl className="save-comparison">
              {changedRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    <div>
                      <small>서버의 최신 내용</small>
                      <p>{row.latest || '비어 있음'}</p>
                    </div>
                    <div>
                      <small>작성 중인 내 입력</small>
                      <p>{row.input || '비어 있음'}</p>
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="field-help">
              비교한 수정 항목은 현재 입력과 같습니다.
            </p>
          )}
          <p className="notice">
            {canReapply
              ? '내 입력으로 다시 저장하면 위 수정 항목을 현재 입력으로 반영합니다. 저장 전에 확인창에서 한 번 더 확인합니다.'
              : restriction ||
                '작업 상태나 권한이 바뀌어 현재 입력을 다시 저장할 수 없습니다. 입력은 그대로 보존합니다.'}
          </p>
        </>
      )}
    </section>
  );
}

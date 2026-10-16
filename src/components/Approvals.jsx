import Icon from './Icon.jsx';
import { useSearchParams } from 'react-router';
import { listApprovals } from '../api/approvals.js';
import { listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { formatDate, memberName } from '../lib/domain.js';
import TaskDetail from './TaskDetail.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

const approvalStatusLabels = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '반려',
};

export default function Approvals({
  team,
  space,
  user,
  members,
  taskId,
  onOpenTask,
  onTaskBack,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(
    searchParams.get('status'),
  )
    ? searchParams.get('status')
    : 'PENDING';
  const setStatus = (value) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'PENDING') next.delete('status');
      else next.set('status', value);
      return next;
    });
  const resource = useResource(
    () => listApprovals(team.id, status),
    [team.id, status, taskId],
  );
  const taskResource = useResource(() => listTasks(team.id), [team.id, taskId]);
  const query = searchParams.get('q') || '';
  const requesterId = searchParams.get('requester') || '';
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const setSearchOption = (key, value, replace = false) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace },
    );
  const clearSearch = () =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ['q', 'requester', 'sort']) next.delete(key);
      return next;
    });
  const reload = () => {
    resource.reload();
    taskResource.reload();
  };
  const listResource = {
    data:
      resource.data != null && taskResource.data != null ? resource.data : null,
    loading: resource.loading || taskResource.loading,
    error: resource.error || taskResource.error,
    reload,
  };
  const approvals = resource.data || [];
  const taskMap = new Map(
    (taskResource.data || []).map((task) => [task.id, task]),
  );
  const getTaskTitle = (id) => taskMap.get(id)?.title || `작업 #${id}`;
  const requesterIds = [
    ...new Set([
      ...members.map((member) => member.userId),
      ...approvals.map((approval) => approval.requesterId),
      ...(requesterId ? [requesterId] : []),
    ]),
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasSearch = Boolean(normalizedQuery || requesterId || sort !== 'newest');
  const visibleApprovals = approvals
    .filter(
      (approval) =>
        (!requesterId || approval.requesterId === requesterId) &&
        (!normalizedQuery ||
          getTaskTitle(approval.taskId)
            .toLocaleLowerCase()
            .includes(normalizedQuery) ||
          `#${approval.taskId}`.includes(normalizedQuery)),
    )
    .sort((left, right) => {
      const requestOrder =
        Date.parse(left.requestedAt) - Date.parse(right.requestedAt) ||
        left.id - right.id;
      return sort === 'oldest' ? requestOrder : -requestOrder;
    });
  if (taskId != null)
    return (
      <TaskDetail
        key={taskId}
        taskId={taskId}
        team={team}
        space={space}
        user={user}
        members={members}
        onBack={onTaskBack}
      />
    );
  return (
    <section className="stack approvals-page">
      <div className="page-heading">
        <div>
          <h1>승인 검토</h1>
          <p>내가 승인자로 지정된 완료 요청입니다.</p>
        </div>
      </div>
      <div className="collection-toolbar approval-list-toolbar">
        <label>
          요청 상태{' '}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="PENDING">승인 대기</option>
            <option value="APPROVED">승인 완료</option>
            <option value="REJECTED">반려</option>
          </select>
        </label>
        <label className="approval-search-field">
          작업 검색
          <input
            type="search"
            aria-label="승인 작업 검색"
            placeholder="작업명 또는 #번호"
            value={query}
            maxLength={100}
            onChange={(event) => setSearchOption('q', event.target.value, true)}
          />
        </label>
        <label>
          요청자
          <select
            aria-label="승인 요청자"
            value={requesterId}
            onChange={(event) => setSearchOption('requester', event.target.value)}
          >
            <option value="">전체 요청자</option>
            {requesterIds.map((id) => (
              <option key={id} value={id}>
                {members.find((member) => member.userId === id)?.name ||
                  '현재 팀원 목록에 없는 요청자'}
              </option>
            ))}
          </select>
        </label>
        <label>
          정렬
          <select
            aria-label="승인 요청 정렬"
            value={sort}
            onChange={(event) =>
              setSearchOption(
                'sort',
                event.target.value === 'newest' ? '' : event.target.value,
              )
            }
          >
            <option value="newest">최근 요청 순</option>
            <option value="oldest">오래된 요청 순</option>
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={listResource.loading}
          onClick={reload}
        >
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      <ResourceState resource={listResource} label="승인 요청 목록">
        <div className="list-summary approval-list-summary" aria-live="polite">
          <span>
            {approvalStatusLabels[status]} {approvals.length}건 · 검색 결과{' '}
            {visibleApprovals.length}건
          </span>
          {hasSearch && (
            <button
              className="secondary-button"
              title="요청 상태는 유지하고 작업 검색·요청자·정렬을 초기화합니다."
              onClick={clearSearch}
            >
              검색 조건 초기화
            </button>
          )}
        </div>
        {visibleApprovals.length ? (
          <div
            className="table-scroll collection-table-scroll"
            role="region"
            aria-label="승인 요청 목록"
            tabIndex={0}
          >
            <table className="data-table collection-table approval-table">
              <caption className="sr-only">
                내가 승인자로 지정된 완료 요청과 처리 결과
              </caption>
              <thead>
                <tr>
                  <th scope="col">작업</th>
                  <th scope="col">상태</th>
                  <th scope="col">요청자</th>
                  <th scope="col">요청일</th>
                  <th scope="col">처리 결과</th>
                  <th scope="col">검토</th>
                </tr>
              </thead>
              <tbody>
                {visibleApprovals.map((approval) => (
                  <tr key={approval.id}>
                    <th scope="row" className="collection-name-cell">
                      <small>#{approval.taskId}</small>
                      <button
                        className="collection-title-button"
                        onClick={() => onOpenTask(approval.taskId)}
                      >
                        {getTaskTitle(approval.taskId)}
                      </button>
                    </th>
                    <td>
                      <span
                        className={`status-badge approval-${approval.status.toLowerCase()}`}
                      >
                        {approvalStatusLabels[approval.status]}
                      </span>
                    </td>
                    <td>{memberName(members, approval.requesterId)}</td>
                    <td>
                      <time dateTime={approval.requestedAt}>
                        {formatDate(approval.requestedAt)}
                      </time>
                    </td>
                    <td className="approval-result-cell">
                      {approval.reason ? (
                        <details>
                          <summary>반려 사유</summary>
                          <p className="preserve-lines">{approval.reason}</p>
                          {approval.decidedAt && (
                            <small>{formatDate(approval.decidedAt)}</small>
                          )}
                        </details>
                      ) : approval.decidedAt ? (
                        <time dateTime={approval.decidedAt}>
                          {formatDate(approval.decidedAt)}
                        </time>
                      ) : (
                        <span className="field-help">검토 전</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => onOpenTask(approval.taskId)}
                      >
                        작업 검토
                        <Icon name="arrow" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            <p>
              {approvals.length
                ? '검색 조건에 맞는 승인 요청이 없습니다.'
                : '해당 상태의 승인 요청이 없습니다.'}
            </p>
            <span>
              {hasSearch
                ? '요청 상태는 유지됩니다. 검색어·요청자를 변경하거나 검색 조건을 초기화하세요.'
                : status === 'PENDING'
                  ? '내가 승인자로 지정된 작업의 완료 요청이 이곳에 표시됩니다.'
                  : '요청 상태를 변경해 다른 검토 내역을 확인하세요.'}
            </span>
          </EmptyState>
        )}
      </ResourceState>
    </section>
  );
}

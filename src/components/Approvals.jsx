import Icon from './Icon.jsx';
import { useSearchParams } from 'react-router';
import { listApprovals } from '../api/approvals.js';
import { listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { formatDate, memberName } from '../lib/domain.js';
import TaskDetail from './TaskDetail.jsx';
import { EmptyState, ErrorNotice, ResourceState } from './ui.jsx';

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
      <div className="collection-toolbar">
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
        <span className="collection-count" role="status">
          {!resource.loading &&
            !resource.error &&
            `${{ PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '반려' }[status]} ${resource.data?.length || 0}건`}
        </span>
        <button
          className="secondary-button"
          disabled={resource.loading || taskResource.loading}
          onClick={() => {
            resource.reload();
            taskResource.reload();
          }}
        >
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      <ErrorNotice error={taskResource.error} onRetry={taskResource.reload} />
      <ResourceState resource={resource}>
        {resource.data?.length ? (
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
                {resource.data.map((approval) => (
                  <tr key={approval.id}>
                    <th scope="row" className="collection-name-cell">
                      <button
                        className="collection-title-button"
                        onClick={() => onOpenTask(approval.taskId)}
                      >
                        {taskResource.data?.find(
                          (task) => task.id === approval.taskId,
                        )?.title || `작업 #${approval.taskId}`}
                      </button>
                    </th>
                    <td>
                      <span
                        className={`status-badge approval-${approval.status.toLowerCase()}`}
                      >
                        {
                          {
                            PENDING: '승인 대기',
                            APPROVED: '승인 완료',
                            REJECTED: '반려',
                          }[approval.status]
                        }
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
            <p>해당 상태의 승인 요청이 없습니다.</p>
            <span>
              {status === 'PENDING'
                ? '내가 승인자로 지정된 작업의 완료 요청이 이곳에 표시됩니다.'
                : '요청 상태를 변경해 다른 검토 내역을 확인하세요.'}
            </span>
          </EmptyState>
        )}
      </ResourceState>
    </section>
  );
}

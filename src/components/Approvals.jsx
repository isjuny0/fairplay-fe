import Icon from './Icon.jsx';
import { useSearchParams } from 'react-router';
import { listApprovals } from '../api/approvals.js';
import useResource from '../hooks/useResource.js';
import { formatDate, memberName } from '../lib/domain.js';
import TaskDetail from './TaskDetail.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function Approvals({
  team,
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
  if (taskId != null)
    return (
      <TaskDetail
        key={taskId}
        taskId={taskId}
        team={team}
        user={user}
        members={members}
        onBack={onTaskBack}
      />
    );
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>승인 검토</h1>
          <p>내가 승인자로 지정된 완료 요청입니다.</p>
        </div>
      </div>
      <div className="toolbar">
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
        <button className="secondary-button" onClick={resource.reload}>
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <ul className="clean-list">
            {resource.data.map((approval) => (
              <li className="panel row-item approval-card" key={approval.id}>
                <span>
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
                  <strong>작업 #{approval.taskId}</strong>
                  <small>
                    요청자 {memberName(members, approval.requesterId)} ·{' '}
                    {formatDate(approval.requestedAt)}
                  </small>
                  {approval.reason && (
                    <small className="preserve-lines">{approval.reason}</small>
                  )}
                </span>
                <button
                  className="primary-button"
                  onClick={() => onOpenTask(approval.taskId)}
                >
                  작업 검토
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>해당 상태의 승인 요청이 없습니다.</EmptyState>
        )}
      </ResourceState>
    </section>
  );
}

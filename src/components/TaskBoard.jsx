import { useState } from 'react';
import { createTask, listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import TaskForm from './TaskForm.jsx';
import TaskDetail from './TaskDetail.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function TaskBoard({ team, user, members }) {
  const resource = useResource(() => listTasks(team.id), [team.id]);
  const [taskId, setTaskId] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [onlyMine, setOnlyMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (input) => {
    setBusy(true);
    setError(null);
    try {
      const task = await createTask(team.id, input);
      setCreating(false);
      resource.reload();
      setTaskId(task.id);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  if (taskId != null)
    return (
      <TaskDetail
        key={taskId}
        taskId={taskId}
        team={team}
        user={user}
        members={members}
        onBack={() => {
          setTaskId(null);
          resource.reload();
        }}
      />
    );
  const tasks =
    resource.data?.filter(
      (task) =>
        (filter === 'ALL' || task.status === filter) &&
        (!onlyMine ||
          task.assignees.some((assignment) => assignment.userId === user.id)),
    ) || [];
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>작업 보드</h1>
          <p>담당 작업을 수행하고 지정 승인자의 검토를 요청하세요.</p>
        </div>
        <button
          className="primary-button"
          disabled={!team.canCreateTask || members.length < 2}
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
        >
          새 작업 만들기
        </button>
      </div>
      {members.length < 2 && (
        <p className="notice">
          승인된 팀원이 2명 이상이어야 작업을 생성할 수 있습니다.
        </p>
      )}
      <div className="toolbar">
        <label>
          상태{' '}
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">전체</option>
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.target.checked)}
          />{' '}
          내 담당 작업만
        </label>
        <button className="secondary-button" onClick={resource.reload}>
          새로고침
        </button>
      </div>
      <ResourceState resource={resource}>
        {tasks.length ? (
          <div className="task-columns">
            {Object.entries(statusLabels).map(([status, label]) => (
              <section className="task-column" key={status}>
                <div className="task-column-heading">
                  <h2>{label}</h2>
                  <span>
                    {tasks.filter((task) => task.status === status).length}
                  </span>
                </div>
                <div className="task-column-list">
                  {tasks
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <article key={task.id} className="board-task-card">
                        <span className="role-badge">가중치 {task.weight}</span>
                        <button
                          className="task-title-button"
                          onClick={() => setTaskId(task.id)}
                        >
                          <h3>{task.title}</h3>
                        </button>
                        <p>
                          {task.assignees
                            .map(
                              (assignment) =>
                                `${memberName(members, assignment.userId)} ${assignment.allocationPercent}%`,
                            )
                            .join(', ')}
                        </p>
                        <small>마감 {formatDate(task.dueAt)}</small>
                        <small>
                          승인자{' '}
                          {memberName(members, task.completionReviewerId)}
                        </small>
                        {task.status !== 'DONE' &&
                          new Date(task.dueAt) < new Date() && (
                            <span className="is-overdue">마감 지남</span>
                          )}
                      </article>
                    ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState>
            <p>표시할 작업이 없습니다.</p>
            <span>새 작업을 만들거나 필터를 변경하세요.</span>
          </EmptyState>
        )}
      </ResourceState>
      {creating && (
        <TaskForm
          members={members}
          user={user}
          busy={busy}
          serverError={error}
          onClose={() => setCreating(false)}
          onSave={save}
        />
      )}
    </section>
  );
}

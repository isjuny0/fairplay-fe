import {
  formatDate,
  formatBoardWorkload,
  formatExpectedWorkload,
  memberName,
  statusLabels,
  toDateInput,
} from '../lib/domain.js';

function TaskDateTime({ value }) {
  const [date, time] = toDateInput(value).split('T');
  return (
    <time dateTime={value} title={formatDate(value)} aria-label={formatDate(value)}>
      <span className="task-date-day">{date.replaceAll('-', '.')}</span>{' '}
      <span className="task-date-clock">{time}</span>
    </time>
  );
}

export default function TaskTable({ tasks, members, onOpenTask, now }) {
  return (
    <div
      className="table-scroll task-table-scroll"
      role="region"
      aria-label="작업 표"
      tabIndex={0}
    >
      <table className="data-table task-table" aria-label="정렬된 작업 목록">
        <thead>
          <tr>
            <th scope="col">작업</th>
            <th scope="col">상태</th>
            <th scope="col">담당자·배분</th>
            <th scope="col">승인자</th>
            <th scope="col">예상 작업량</th>
            <th scope="col">시작일</th>
            <th scope="col">마감일</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <th scope="row">
                <span className="task-number">#{task.id}</span>
                <button
                  className="task-title-button"
                  title={task.title}
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.title}
                </button>
              </th>
              <td>
                <span
                  className={`status-badge task-state-${task.status.toLowerCase()}`}
                >
                  {statusLabels[task.status]}
                </span>
              </td>
              <td>
                {task.assignees.map((assignment) => (
                  <span className="task-table-assignee" key={assignment.userId}>
                    {memberName(members, assignment.userId)}{' '}
                    <span>{assignment.allocationPercent}%</span>
                  </span>
                ))}
              </td>
              <td>{memberName(members, task.completionReviewerId)}</td>
              <td title={formatExpectedWorkload(task.weight)}>{formatBoardWorkload(task.weight)}</td>
              <td>
                <TaskDateTime value={task.startAt} />
              </td>
              <td>
                <TaskDateTime value={task.dueAt} />
                {task.status !== 'DONE' &&
                  Date.parse(task.dueAt) < now && (
                    <span className="is-overdue">마감 지남</span>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

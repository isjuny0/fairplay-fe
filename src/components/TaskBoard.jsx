import Icon from './Icon.jsx';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { createTask, listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import { useInteractions } from '../hooks/useInteractions.js';
import {
  canModifyTeamWork,
  formatDate,
  formatExpectedWorkload,
  memberName,
  statusLabels,
} from '../lib/domain.js';
import TaskForm from './TaskForm.jsx';
import TaskDetail from './TaskDetail.jsx';
import { EmptyState, ResourceState } from './ui.jsx';

export default function TaskBoard({
  team,
  space,
  user,
  members,
  taskId,
  onOpenTask,
  onTaskBack,
}) {
  const { notify, clearChanges } = useInteractions();
  const resource = useResource(() => listTasks(team.id), [team.id, taskId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = Object.hasOwn(statusLabels, searchParams.get('status'))
    ? searchParams.get('status')
    : 'ALL';
  const onlyMine = searchParams.get('mine') === '1';
  const onlyOverdue = searchParams.get('overdue') === '1';
  const view = searchParams.get('view') === 'list' ? 'list' : 'board';
  const query = searchParams.get('q') || '';
  const sort = ['deadline', 'newest'].includes(searchParams.get('sort'))
    ? searchParams.get('sort')
    : 'deadline';
  const setListOption = (key, value, replace = false) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace },
    );
  const clearFilters = () =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ['status', 'mine', 'q', 'overdue']) next.delete(key);
      return next;
    });
  const setFilter = (status) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (status === 'ALL') next.delete('status');
      else next.set('status', status);
      return next;
    });
  const setOnlyMine = (checked) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (checked) next.set('mine', '1');
      else next.delete('mine');
      return next;
    });
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async (input) => {
    if (!canModifyTeamWork(team)) return;
    setBusy(true);
    setError(null);
    try {
      const task = await createTask(team.id, input);
      setCreating(false);
      clearChanges();
      notify('작업을 생성했습니다.');
      onOpenTask(task.id);
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
        space={space}
        user={user}
        members={members}
        onBack={onTaskBack}
      />
    );
  const canCreate =
    team.canCreateTask && members.length >= 2 && canModifyTeamWork(team);
  const hasFilters =
    filter !== 'ALL' || onlyMine || onlyOverdue || Boolean(query.trim());
  const isOverdue = (task) =>
    task.status !== 'DONE' && new Date(task.dueAt) < new Date();
  const tasks = (resource.data || [])
    .filter(
      (task) =>
        (filter === 'ALL' || task.status === filter) &&
        (!onlyOverdue || isOverdue(task)) &&
        (!onlyMine ||
          task.assignees.some((assignment) => assignment.userId === user.id)) &&
        task.title
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((left, right) =>
      sort === 'newest'
        ? (Date.parse(right.createdAt) || 0) -
            (Date.parse(left.createdAt) || 0) || right.id - left.id
        : (Date.parse(left.dueAt) || Infinity) -
            (Date.parse(right.dueAt) || Infinity) || right.id - left.id,
    );
  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>작업 보드</h1>
          <p>담당 작업을 수행하고 지정 승인자의 검토를 요청하세요.</p>
        </div>
        <button
          className="primary-button"
          disabled={!canCreate}
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
        >
          <Icon name="plus" />새 작업 만들기
        </button>
      </div>
      <div
        className={`mobile-status-tabs ${view === 'list' ? 'list-status-tabs' : ''}`}
        role="group"
        aria-label="작업 상태 선택"
      >
        {[['ALL', '전체'], ...Object.entries(statusLabels)].map(
          ([status, label]) => (
            <button
              key={status}
              className={filter === status ? 'active' : ''}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {label}
              <span>
                {
                  (resource.data || []).filter(
                    (task) =>
                      (status === 'ALL' || task.status === status) &&
                      (!onlyOverdue || isOverdue(task)) &&
                      task.title
                        .toLocaleLowerCase()
                        .includes(query.trim().toLocaleLowerCase()) &&
                      (!onlyMine ||
                        task.assignees.some(
                          (assignment) => assignment.userId === user.id,
                        )),
                  ).length
                }
              </span>
            </button>
          ),
        )}
      </div>
      {members.length < 2 && (
        <p className="notice">
          승인된 팀원이 2명 이상이어야 작업을 생성할 수 있습니다.
        </p>
      )}
      <div className="toolbar">
        <div className="view-switch" role="group" aria-label="작업 보기 방식">
          <button
            aria-pressed={view === 'board'}
            className={view === 'board' ? 'active' : ''}
            onClick={() => setListOption('view', '')}
          >
            보드
          </button>
          <button
            aria-pressed={view === 'list'}
            className={view === 'list' ? 'active' : ''}
            onClick={() => setListOption('view', 'list')}
          >
            목록
          </button>
        </div>
        <label className="task-status-filter">
          상태{' '}
          <select
            aria-label="작업 상태"
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
        <label className="task-search-filter">
          제목 검색
          <input
            type="search"
            aria-label="작업 제목 검색"
            placeholder="작업 제목 입력"
            value={query}
            maxLength={100}
            onChange={(event) => setListOption('q', event.target.value, true)}
          />
        </label>
        <label>
          정렬
          <select
            aria-label="작업 정렬"
            value={sort}
            onChange={(event) =>
              setListOption(
                'sort',
                event.target.value === 'deadline' ? '' : event.target.value,
              )
            }
          >
            <option value="deadline">마감 빠른 순</option>
            <option value="newest">최근 생성 순</option>
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
        <label>
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(event) =>
              setListOption('overdue', event.target.checked ? '1' : '')
            }
          />{' '}
          마감 지난 작업만
        </label>
        <button className="secondary-button" onClick={resource.reload}>
          <Icon name="refresh" />
          새로고침
        </button>
      </div>
      <ResourceState resource={resource}>
        <div className="list-summary">
          <span>
            {tasks.length}개 작업 · 전체 {resource.data?.length || 0}개 ·{' '}
            {view === 'board' ? '상태별 ' : ''}
            {sort === 'newest' ? '최근 생성 순' : '마감 빠른 순'}
          </span>
          {hasFilters && (
            <button className="text-button" onClick={clearFilters}>
              검색·필터 초기화
            </button>
          )}
        </div>
        {tasks.length && view === 'list' ? (
          <ul className="task-list-view" aria-label="정렬된 작업 목록">
            {tasks.map((task) => (
              <li className="panel task-list-item" key={task.id}>
                <div className="task-list-main">
                  <span
                    className={`status-badge task-state-${task.status.toLowerCase()}`}
                  >
                    {statusLabels[task.status]}
                  </span>
                  <button
                    className="task-title-button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <h3>{task.title}</h3>
                  </button>
                  <p className="task-list-assignees">
                    담당{' '}
                    {task.assignees
                      .map(
                        (assignment) =>
                          `${memberName(members, assignment.userId)} ${assignment.allocationPercent}%`,
                      )
                      .join(' · ')}
                  </p>
                </div>
                <div className="task-list-deadline">
                  <span>마감 {formatDate(task.dueAt)}</span>
                  {isOverdue(task) && (
                    <span className="is-overdue">마감 지남</span>
                  )}
                </div>
                <details className="task-list-more">
                  <summary>승인·작업량</summary>
                  <p>승인 {memberName(members, task.completionReviewerId)}</p>
                  <p>{formatExpectedWorkload(task.weight)}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : tasks.length ? (
          <div className="task-columns">
            {Object.entries(statusLabels).map(
              ([status, label]) =>
                (filter === 'ALL' || filter === status) && (
                  <section
                    className={`task-column task-state-${status.toLowerCase()}`}
                    key={status}
                  >
                    <div className="task-column-heading">
                      <h2>
                        <span className="status-dot" />
                        {label}
                      </h2>
                      <span>
                        {tasks.filter((task) => task.status === status).length}
                      </span>
                    </div>
                    <div className="task-column-list">
                      {!tasks.some((task) => task.status === status) && (
                        <p className="column-empty">
                          {hasFilters
                            ? '조건에 맞는 작업이 없습니다'
                            : '아직 작업이 없습니다'}
                        </p>
                      )}
                      {tasks
                        .filter((task) => task.status === status)
                        .map((task) => (
                          <article key={task.id} className="board-task-card">
                            <div className="board-card-top">
                              <span className="mobile-task-state">{label}</span>
                              <span className="task-number">#{task.id}</span>
                            </div>
                            <button
                              className="task-title-button"
                              onClick={() => onOpenTask(task.id)}
                            >
                              <h3>{task.title}</h3>
                            </button>
                            <p className="task-workload-line">
                              {formatExpectedWorkload(task.weight)}
                            </p>
                            <dl className="task-card-meta">
                              <div>
                                <dt>담당</dt>
                                <dd>
                                  {task.assignees.map((assignment) => (
                                    <span
                                      key={assignment.userId}
                                      className={
                                        assignment.userId === user.id
                                          ? 'my-assignment'
                                          : ''
                                      }
                                    >
                                      {memberName(members, assignment.userId)}{' '}
                                      <b>{assignment.allocationPercent}%</b>
                                    </span>
                                  ))}
                                </dd>
                              </div>
                              <div>
                                <dt>승인</dt>
                                <dd>
                                  {memberName(
                                    members,
                                    task.completionReviewerId,
                                  )}
                                </dd>
                              </div>
                            </dl>
                            <div className="task-deadline">
                              <Icon name="calendar" />
                              <small>마감 {formatDate(task.dueAt)}</small>
                            </div>
                            {task.status !== 'DONE' &&
                              new Date(task.dueAt) < new Date() && (
                                <span className="is-overdue">마감 지남</span>
                              )}
                          </article>
                        ))}
                    </div>
                  </section>
                ),
            )}
          </div>
        ) : (
          <EmptyState>
            <p>
              {hasFilters
                ? '조건에 맞는 작업이 없습니다.'
                : '아직 등록된 작업이 없습니다.'}
            </p>
            <span>
              {hasFilters
                ? '검색어와 상태, 담당·마감 조건을 초기화해 전체 작업을 확인하세요.'
                : canCreate
                  ? '작업 내용을 정하고 담당자와 완료 승인자를 선택해 시작하세요.'
                  : members.length < 2
                    ? '승인된 팀원이 2명 이상 모이면 작업을 만들 수 있습니다.'
                    : '현재 팀 상태에서는 새 작업을 만들 수 없습니다. 팀 설정에서 상태를 확인하세요.'}
            </span>
            {hasFilters ? (
              <button className="secondary-button" onClick={clearFilters}>
                전체 작업 보기
              </button>
            ) : (
              canCreate && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setError(null);
                    setCreating(true);
                  }}
                >
                  첫 작업 만들기
                </button>
              )
            )}
          </EmptyState>
        )}
      </ResourceState>
      {creating && (
        <TaskForm
          team={team}
          members={members}
          user={user}
          busy={busy}
          blocked={!canModifyTeamWork(team)}
          serverError={error}
          onClose={() => setCreating(false)}
          onSave={save}
        />
      )}
    </section>
  );
}

import { apiTimeToEpoch } from '../lib/koreanTime.js';
import { screenLoaders } from '../lib/routeScreens.js';
import { deferScreen } from './DeferredScreen.jsx';
import Icon from './Icon.jsx';
import RefreshButton from './RefreshButton.jsx';
import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { createTask, listTasks } from '../api/tasks.js';
import useResource from '../hooks/useResource.js';
import useCurrentTime from '../hooks/useCurrentTime.js';
import { useInteractions } from '../hooks/useInteractions.js';
import {
  canModifyTeamWork,
  formatDate,
  formatBoardWorkload,
  formatExpectedWorkload,
  memberName,
  statusLabels,
} from '../lib/domain.js';

import { isTaskExecutionOverdue } from '../lib/evaluation.js';

import TaskTable from './TaskTable.jsx';
import { TimelineNavigation, TaskTimeline } from './TaskSchedule.jsx';
import {
  currentTaskMonth,
  isTaskMonth,
  nearestTaskMonth,
  timelineTaskPeriod,
  timelineWindow,
} from '../lib/taskSchedule.js';
import { EmptyState, Modal, ResourceState } from './ui.jsx';
import { normalizeTaskView, readTaskViewPreferences, saveTaskViewPreferences } from '../lib/taskViewPreferences.js';

const TaskForm = deferScreen(screenLoaders.TaskForm, '작업 입력');
const TaskDetail = deferScreen(screenLoaders.TaskDetail, '작업 상세');

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
  const now = useCurrentTime();
  const resource = useResource(() => listTasks(team.id), [team.id, taskId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterControls = useRef({});
  const filterToggle = useRef(null);
  const filter = Object.hasOwn(statusLabels, searchParams.get('status'))
    ? searchParams.get('status')
    : 'ALL';
  const onlyMine = searchParams.get('mine') === '1';
  const onlyExecutionOverdue = searchParams.get('overdue') === 'work';
  const onlyOverdue = onlyExecutionOverdue || searchParams.get('overdue') === '1';
  const [preferences, setPreferences] = useState(readTaskViewPreferences);
  const [expandedBoardTaskIds, setExpandedBoardTaskIds] = useState(() => new Set());
  const urlView = searchParams.get('view');
  const view = urlView !== null ? normalizeTaskView(urlView) : preferences.view;
  useEffect(() => {
    if (urlView === view || taskId != null) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('view', view);
      return next;
    }, { replace: true });
  }, [view, urlView, taskId, setSearchParams]);
  const timelineLabelWidth = preferences.labelWidth;
  const setTimelineLabelWidth = (labelWidth) =>
    setPreferences((current) => ({ ...current, labelWidth }));
  useEffect(() => {
    saveTaskViewPreferences({ view, labelWidth: timelineLabelWidth });
    if (preferences.view !== view)
      setPreferences((current) => ({ ...current, view }));
  }, [view, timelineLabelWidth, preferences.view]);
  const month = isTaskMonth(searchParams.get('month'))
    ? searchParams.get('month')
    : currentTaskMonth();
  const query = searchParams.get('q') || '';
  const defaultSort = view === 'timeline' ? 'start' : 'deadline';
  const sortLabels = {
    deadline: '마감 빠른 순',
    newest: '최근 생성 순',
    start: '시작일 순',
  };
  const sort = ['deadline', 'newest', 'start'].includes(
    searchParams.get('sort'),
  )
    ? searchParams.get('sort')
    : defaultSort;
  const sortLabel = sortLabels[sort];
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
  const clearFilters = () => {
    filterControls.current.q?.focus();
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ['status', 'mine', 'q', 'overdue', 'sort'])
        next.delete(key);
      return next;
    });
  };
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();
  const appliedFilterCount = [
    filter !== 'ALL',
    onlyMine,
    onlyOverdue,
    Boolean(query.trim()),
    sort !== defaultSort,
  ].filter(Boolean).length;
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    return () => requestAnimationFrame(() => expandButton.current?.focus());
  }, [expanded]);
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
  const toggleBoardTaskDetails = (taskId) =>
    setExpandedBoardTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  const canCreate =
    team.canCreateTask && members.length >= 2 && canModifyTeamWork(team);
  const hasFilters = appliedFilterCount > 0;
  const isOverdue = (task) =>
    task.status !== 'DONE' && apiTimeToEpoch(task.dueAt) < now;
  const tasks = (resource.data || [])
    .filter(
      (task) =>
        (filter === 'ALL' || task.status === filter) &&
        (!onlyOverdue || (onlyExecutionOverdue ? isTaskExecutionOverdue(task, now) : isOverdue(task))) &&
        (!onlyMine ||
          task.assignees.some((assignment) => assignment.userId === user.id)) &&
        task.title
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((left, right) =>
      sort === 'newest'
        ? (apiTimeToEpoch(right.createdAt) || 0) -
            (apiTimeToEpoch(left.createdAt) || 0) || right.id - left.id
        : sort === 'start'
          ? apiTimeToEpoch(left.startAt) - apiTimeToEpoch(right.startAt) ||
            apiTimeToEpoch(left.dueAt) - apiTimeToEpoch(right.dueAt) ||
            left.id - right.id
          : (apiTimeToEpoch(left.dueAt) || Infinity) -
              (apiTimeToEpoch(right.dueAt) || Infinity) || right.id - left.id,
    );
  const isSchedule = view === 'timeline';
  const scheduleWindow = view === 'timeline' ? timelineWindow(month) : null;
  const periodTaskCount = view === 'timeline'
    ? tasks.filter((task) => timelineTaskPeriod(task, scheduleWindow, now)).length
    : 0;
  const nearestMonth = nearestTaskMonth(tasks, `${month}-01`);
  const hasSearchFilters = filter !== 'ALL' || onlyMine || onlyOverdue || Boolean(query.trim());
  const activeFilters = [
    ...(filter !== 'ALL' ? [{ key: 'status', label: `상태: ${statusLabels[filter]}` }] : []),
    ...(onlyMine ? [{ key: 'mine', label: '내 담당' }] : []),
    ...(onlyOverdue ? [{ key: 'overdue', label: onlyExecutionOverdue ? '수행 지연: 할 일·진행 중·수정 중' : '마감 지남' }] : []),
    ...(query.trim() ? [{ key: 'q', label: `검색: ${query.trim()}` }] : []),
    ...(sort !== defaultSort ? [{ key: 'sort', label: `정렬: ${sortLabel}` }] : []),
  ];
  const listSummary = (
    <div className="list-summary" aria-live="polite">
      <span>
        검색 결과 {tasks.length}개 · 전체 {resource.data?.length || 0}개
        {isSchedule && ` · 현재 기간 ${periodTaskCount}개 (지연 포함)`} ·{' '}
        {view === 'board' ? '상태별 ' : ''}
        {sortLabel}
      </span>
      {hasFilters && (
        <button className="text-button collection-reset-button" title="검색·상태·담당·마감·정렬 조건을 초기화하고 보기와 조회 기간은 유지합니다." onClick={clearFilters}>
          검색·필터 초기화
        </button>
      )}
    </div>
  );
  const content = (
    <section className="stack task-board-page" data-task-view={view}>
      <div className="page-heading task-collection-heading">
        <h1>작업</h1>
        <div
          className="view-switch task-view-navigation"
          role="group"
          aria-label="작업 보기 방식"
        >
          {[
            ['board', '보드'],
            ['list', '목록'],
            ['timeline', '타임라인'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              aria-pressed={view === mode}
              className={view === mode ? 'active' : ''}
              onClick={() => {
                if (mode === 'board' || mode === 'list') setExpanded(false);
                setListOption('view', mode);
              }}
            >
              {label}
            </button>
          ))}
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
                      (!onlyOverdue || (onlyExecutionOverdue ? isTaskExecutionOverdue(task, now) : isOverdue(task))) &&
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
      <div className="toolbar collection-controls">
        <label className="task-status-filter" data-active={filter !== 'ALL'}>
          상태{' '}
          <select
            ref={(node) => { filterControls.current.status = node; }}
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
          <span className="sr-only">제목 검색</span>
          <input
            type="search"
            ref={(node) => { filterControls.current.q = node; }}
            aria-label="작업 제목 검색"
            placeholder="작업 제목 입력"
            value={query}
            maxLength={100}
            onChange={(event) => setListOption('q', event.target.value, true)}
          />
        </label>
        <button
          ref={filterToggle}
          className="secondary-button mobile-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls={filterPanelId}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          필터{appliedFilterCount > 0 ? ` · ${appliedFilterCount}` : ''}
        </button>
        <div
          id={filterPanelId}
          className={`task-filter-fields ${filtersOpen ? 'is-open' : ''}`}
        >
          <label data-active={sort !== defaultSort}>
            정렬
            <select
              ref={(node) => { filterControls.current.sort = node; }}
              aria-label="작업 정렬"
              value={sort}
              onChange={(event) =>
                setListOption(
                  'sort',
                  event.target.value === defaultSort ? '' : event.target.value,
                )
              }
            >
              <option value="start">시작일 순</option>
              <option value="deadline">마감 빠른 순</option>
              <option value="newest">최근 생성 순</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              ref={(node) => { filterControls.current.mine = node; }}
              checked={onlyMine}
              onChange={(event) => setOnlyMine(event.target.checked)}
            />{' '}
            내 담당 작업만
          </label>
          <label>
            <input
              type="checkbox"
              ref={(node) => { filterControls.current.overdue = node; }}
              checked={onlyOverdue}
              onChange={(event) =>
                setListOption('overdue', event.target.checked ? '1' : '')
              }
            />{' '}
            마감 지난 작업만
          </label>
        </div>
        <RefreshButton onClick={resource.reload} />
      </div>
      {isSchedule && (
        <div className="task-schedule-controls">
          <TimelineNavigation
            month={month}
            onMonthChange={(next) => setListOption('month', next)}
            tasks={tasks}
            helpText="막대의 위치와 겹침으로 일정의 순서와 병행 구간을 비교합니다. 막대는 계획 기간, 빨간 빗금은 마감 이후 오늘까지의 지연 구간입니다. 작업 제목이나 막대를 선택하면 상세를 확인할 수 있습니다."
          />
          <button
            ref={expandButton}
            className="secondary-button"
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '원래 크기로' : '일정 넓게 보기'}
          </button>
        </div>
      )}
      {!!activeFilters.length && (
        <div className="task-active-filters collection-applied-filters" role="group" aria-label="적용 중인 검색·필터">
          <span className="collection-filter-caption">적용 중</span>
          {activeFilters.map(({ key, label }) => (
            <button
              key={key}
              className="task-filter-chip collection-filter-chip"
              aria-label={`${label} 해제`}
              title={`${label} 해제`}
              onClick={() => {
                const control = filterControls.current[key];
                (control?.getClientRects().length ? control : filterToggle.current)?.focus();
                setListOption(key, '');
              }}
            >
              <span>{label}</span>
              <Icon name="close" />
            </button>
          ))}
        </div>
      )}
      <ResourceState resource={resource} label="작업 목록">
        {listSummary}
        {isSchedule && periodTaskCount === 0 ? (
          <EmptyState>
            <p>이 기간에 예정되거나 지연 중인 작업이 없습니다.</p>
            <span>{tasks.length
              ? `검색 결과 ${tasks.length}개의 작업은 다른 기간에 있습니다.`
              : hasSearchFilters && resource.data?.length
                ? '검색·필터 조건에 맞는 작업이 없습니다. 조건을 초기화해 다시 확인하세요.'
                : '아직 등록된 작업이 없습니다. 새 작업을 만들어 시작하세요.'}</span>
            <div className="heading-actions">
              {nearestMonth && (
                <button className="secondary-button" onClick={() => setListOption('month', nearestMonth)}>
                  작업 있는 기간으로 이동
                </button>
              )}
              {hasSearchFilters && !!resource.data?.length && (
                <button className="secondary-button" onClick={clearFilters}>필터 초기화</button>
              )}
            </div>
          </EmptyState>
        ) : view === 'timeline' ? (
          <TaskTimeline
            now={now}
            sortLabel={sortLabel}
            labelWidth={timelineLabelWidth}
            onLabelWidthChange={setTimelineLabelWidth}
            onlyOverdue={onlyOverdue}
            onToggleOverdue={() => setListOption('overdue', onlyOverdue ? '' : '1')}
            tasks={tasks}
            month={month}
            members={members}
            onOpenTask={onOpenTask}
          />
        ) : tasks.length && view === 'list' ? (
          <TaskTable now={now} tasks={tasks} members={members} onOpenTask={onOpenTask} />
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
                        .map((task) => {
                          const detailsExpanded = expandedBoardTaskIds.has(task.id);
                          const detailsId = `board-task-details-${task.id}`;
                          return (
                            <article
                              key={task.id}
                              className={`board-task-card${detailsExpanded ? ' is-expanded' : ''}`}
                            >
                              <div className="board-card-top">
                                <span className="board-card-heading">
                                  <span className="mobile-task-state">{label}</span>
                                  <span className="task-number">#{task.id}</span>
                                </span>
                                {task.status !== 'DONE' &&
                                  apiTimeToEpoch(task.dueAt) < now && (
                                    <span className="is-overdue board-card-overdue">마감 지남</span>
                                  )}
                              </div>
                              <button
                                className="task-title-button"
                                onClick={() => onOpenTask(task.id)}
                              >
                                <h3>{task.title}</h3>
                              </button>
                              <div className="board-card-footer">
                                <div className="task-deadline">
                                  <Icon name="calendar" />
                                  <small>마감 {formatDate(task.dueAt)}</small>
                                </div>
                              <button
                                className="board-card-details-toggle"
                                aria-expanded={detailsExpanded}
                                aria-controls={detailsId}
                                aria-label={`${task.title} 상세 ${detailsExpanded ? '접기' : '보기'}`}
                                title={detailsExpanded ? '상세 접기' : '상세 보기'}
                                onClick={() => toggleBoardTaskDetails(task.id)}
                              >
                                <span className="board-card-toggle-triangle" aria-hidden="true" />
                              </button>
                              </div>
                              {detailsExpanded && (
                                <div id={detailsId} className="board-task-details">
                                  <p
                                    className="task-workload-line"
                                    title={formatExpectedWorkload(task.weight)}
                                    aria-label={formatExpectedWorkload(task.weight)}
                                  >
                                    {formatBoardWorkload(task.weight)}
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
                                  </dl>
                                </div>
                              )}
                            </article>
                          );
                        })}
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
                  ? '작업 내용을 정하고 담당자와 배분을 정해 시작하세요.'
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
  return expanded ? (
    <Modal title="작업 일정 넓게 보기" fullscreen onClose={() => setExpanded(false)}>
      {content}
    </Modal>
  ) : content;
}

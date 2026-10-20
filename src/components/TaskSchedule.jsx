import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskMonthDays,
  taskDateMarkers,
  timelineTaskPeriod,
  timelineWindow,
} from '../lib/taskSchedule.js';
import { Modal } from './ui.jsx';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const monthLabel = (month) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
const shortDate = (date) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(-2))}`;
const scheduleLabel = (task) =>
  `${task.title} · 시작일 ${formatDate(task.startAt)} · 마감 ${formatDate(task.dueAt)}`;

export function MonthNavigation({ month, onMonthChange, tasks, span = 1 }) {
  const previous = moveTaskMonth(month, -span),
    next = moveTaskMonth(month, span);
  const nearest = nearestTaskMonth(tasks);
  const lastMonth = span === 3 ? timelineWindow(month).months.at(-1) : month;
  return (
    <div className="task-month-navigation">
      <div className="heading-actions">
        <button
          className="secondary-button"
          aria-label={span === 3 ? '이전 3개월' : '이전 달'}
          disabled={!previous}
          onClick={() => onMonthChange(previous)}
        >
          ←
        </button>
        <h2>
          {monthLabel(month)}
          {span === 3 && lastMonth !== month
            ? ` – ${monthLabel(lastMonth)}`
            : ''}
        </h2>
        <button
          className="secondary-button"
          aria-label={span === 3 ? '다음 3개월' : '다음 달'}
          disabled={!next}
          onClick={() => onMonthChange(next)}
        >
          →
        </button>
        <button
          className="secondary-button"
          onClick={() => onMonthChange(currentTaskMonth())}
        >
          오늘
        </button>
      </div>
      <label>
        <span className="sr-only">
          {span === 3 ? '조회 시작 월' : '조회 월'}
        </span>
        <input
          aria-label={span === 3 ? '조회 시작 월' : '조회 월'}
          type="month"
          min="0001-01"
          max="9999-12"
          value={month}
          onChange={(event) => {
            if (isTaskMonth(event.target.value))
              onMonthChange(event.target.value);
          }}
        />
      </label>
      {nearest && nearest !== month && (
        <button className="text-button" onClick={() => onMonthChange(nearest)}>
          가까운 마감으로
        </button>
      )}
    </div>
  );
}

function ScheduleTask({ task, onOpenTask, members }) {
  return (
    <button
      className={`schedule-task schedule-task-${task.status.toLowerCase()}`}
      onClick={() => onOpenTask(task.id)}
      title={scheduleLabel(task)}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="schedule-task-title">{task.title}</span>
      <span>
        {statusLabels[task.status]} · 시작일 {formatDate(task.startAt)} · 마감{' '}
        {formatDate(task.dueAt)}
      </span>
      <span>
        담당{' '}
        {task.assignees
          .map((assignment) => memberName(members, assignment.userId))
          .join(' · ')}
      </span>
    </button>
  );
}

export function TaskCalendar({
  now,
  tasks,
  month,
  onOpenTask,
  members,
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const days = taskMonthDays(month),
    markersByDate = taskDateMarkers(tasks, days);
  const today = taskDate(new Date(now).toISOString());
  return (
    <section className="task-schedule" aria-label="작업 캘린더">
      <div
        className="task-calendar-scroll"
        role="region"
        aria-label="월간 작업 일정"
        tabIndex={0}
      >
        <table
          className="task-calendar-table"
          aria-label={`${monthLabel(month)} 작업 시작·마감 일정`}
        >
          <thead>
            <tr>
              {weekdays.map((day) => (
                <th scope="col" key={day}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: days.length / 7 }, (_, week) => {
              const dates = days.slice(week * 7, week * 7 + 7);
              return (
                <tr className="calendar-dates" key={week}>
                  {dates.map((date, index) => {
                    const markers = date ? markersByDate.get(date) || [] : [];
                    return (
                      <td
                        key={date || `empty-${index}`}
                        className={date === today ? 'is-today' : ''}
                        aria-label={date ? `${date} 작업 일정` : undefined}
                      >
                        {date && (markers.length ? (
                          <button
                            className="calendar-date-markers"
                            aria-label={`${date} 시작·마감 작업 ${markers.length}개 보기`}
                            onClick={() => setSelectedDate(date)}
                          >
                            <time
                              dateTime={date}
                              aria-current={date === today ? 'date' : undefined}
                            >
                              {Number(date.slice(-2))}
                            </time>
                            <span className="calendar-marker-list" aria-hidden="true">
                              {markers.map(({ task, type }, markerIndex) => (
                                <span
                                  key={`${task.id}-${type}-${markerIndex}`}
                                  className={`calendar-date-marker schedule-task-${task.status.toLowerCase()}`}
                                  title={`${task.title} ${type === 'start' ? '시작' : '마감'}`}
                                />
                              ))}
                            </span>
                          </button>
                        ) : (
                          <time
                            dateTime={date}
                            aria-current={date === today ? 'date' : undefined}
                          >
                            {Number(date.slice(-2))}
                          </time>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="task-schedule-help">
        <summary>캘린더 읽는 법</summary>
        <p>점은 작업의 시작일 또는 마감일을 뜻하며, 색으로 진행 상태를 구분합니다. 점이 있는 날짜를 선택하면 해당 작업을 확인할 수 있습니다.</p>
      </details>
      {selectedDate && (
        <Modal
          title={`${selectedDate} 작업 일정`}
          onClose={() => setSelectedDate(null)}
        >
          <div className="stack">
            {[...new Map(
              (markersByDate.get(selectedDate) || []).map(({ task }) => [task.id, task]),
            ).values()].map((task) => (
              <ScheduleTask
                key={task.id}
                task={task}
                onOpenTask={onOpenTask}
                members={members}
              />
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

export function TaskTimeline({
  now,
  tasks,
  month,
  onOpenTask,
  members,
  sortLabel,
  onlyOverdue,
  onToggleOverdue,
  labelWidth,
  onLabelWidthChange,
}) {
  const [preview, setPreview] = useState(null);
  const previewId = useId();
  const closeTimer = useRef(null);
  const hoverTimer = useRef(null);
  const resizeStart = useRef(null);
  const previousSchedule = useRef({ tasks, month });
  const cancelHover = () => clearTimeout(hoverTimer.current);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const closePreview = () => {
    cancelClose();
    cancelHover();
    closeTimer.current = setTimeout(() => {
      setPreview((current) =>
        document.activeElement === current?.anchor ? current : null,
      );
    }, 120);
  };
  const previewEvents = (task, period) => ({
    'aria-describedby': preview?.task.id === task.id ? previewId : undefined,
    onMouseEnter: (event) => {
      cancelHover();
      cancelClose();
      const anchor = event.currentTarget;
      hoverTimer.current = setTimeout(() => showPreview(anchor, task, period), 200);
    },
    onMouseLeave: (event) => {
      cancelHover();
      if (document.activeElement !== event.currentTarget) closePreview();
    },
    onFocus: (event) => showPreview(event.currentTarget, task, period),
    onBlur: closePreview,
  });
  const showPreview = (anchor, task, period) => {
    cancelHover();
    cancelClose();
    const bounds = anchor.getBoundingClientRect();
    const width = Math.min(320, globalThis.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(bounds.left, globalThis.innerWidth - width - 12),
    );
    setPreview({ task, period, anchor, left, top: bounds.bottom + 8, width });
  };
  useEffect(() => {
    const dismiss = (event) => {
      if (event?.target instanceof Element && event.target.closest('.timeline-preview')) return;
      clearTimeout(closeTimer.current);
      clearTimeout(hoverTimer.current);
      setPreview(null);
    };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (document.getElementById(previewId)) {
        event.preventDefault();
        event.stopPropagation();
      }
      dismiss();
    };
    globalThis.addEventListener('scroll', dismiss, true);
    globalThis.addEventListener('resize', dismiss);
    globalThis.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      clearTimeout(closeTimer.current);
      clearTimeout(hoverTimer.current);
      globalThis.removeEventListener('scroll', dismiss, true);
      globalThis.removeEventListener('resize', dismiss);
      globalThis.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, []);
  useEffect(() => {
    const previous = previousSchedule.current;
    previousSchedule.current = { tasks, month };
    const sameTasks = previous.tasks.length === tasks.length &&
      previous.tasks.every((task, index) => task === tasks[index]);
    if (previous.month === month && sameTasks) return;
    clearTimeout(hoverTimer.current);
    clearTimeout(closeTimer.current);
    setPreview(null);
  }, [tasks, month]);
  const window = timelineWindow(month);
  const previewPeriod = preview ? timelineTaskPeriod(preview.task, window, now) : null;
  const visible = tasks
    .map((task) => ({ task, period: timelineTaskPeriod(task, window, now) }))
    .filter(({ period }) => period);
  const today = taskDate(new Date(now).toISOString());
  const todayPosition =
    today >= window.first && today <= window.last
      ? window.position(today) + 50 / window.dayCount
      : null;
  const monthBands = window.months.map((value, index) => {
    const left = window.position(`${value}-01`);
    const next = window.months[index + 1];
    return {
      value,
      left,
      width: next ? window.position(`${next}-01`) - left : 100 - left,
    };
  });
  const lateCount = visible.filter(({ period }) => period.overdue).length;
  const startPassedCount = visible.filter(
    ({ period }) => period.startPassed,
  ).length;
  return (
    <section className="task-schedule" aria-label="작업 타임라인" style={{ '--timeline-label-width': `${labelWidth}px` }}>
      <div className="timeline-overview">
        <div className="timeline-summary" aria-label="조회 기간 작업 현황">
          <button
            className={`timeline-late-filter${lateCount ? ' is-overdue' : ''}`}
            aria-pressed={onlyOverdue}
            onClick={onToggleOverdue}
          >
            마감 지남 <strong>{lateCount}</strong>
          </button>
          <span>
            시작 예정일 지남 <strong>{startPassedCount}</strong>
          </span>
        </div>
        <div className="timeline-legend" aria-label="타임라인 상태 범례">
          {Object.entries(statusLabels).map(([status, label]) => (
            <span
              key={status}
              className={`schedule-task-${status.toLowerCase()}`}
            >
              <span className="status-dot" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div
        className="task-timeline-scroll"
        role="region"
        aria-label="작업 계획 타임라인"
        tabIndex={0}
      >
        <div className="task-timeline">
          <div className="timeline-row timeline-header">
            <div className="timeline-task-label">
              작업 · {sortLabel}
              <div
                className="timeline-column-resizer"
                role="separator"
                aria-label="작업명 영역 너비"
                aria-orientation="vertical"
                aria-valuemin={220}
                aria-valuemax={520}
                aria-valuenow={labelWidth}
                aria-valuetext={`${labelWidth}픽셀`}
                tabIndex={0}
                title="드래그 또는 방향키로 너비 조절 · 두 번 클릭해 초기화"
                onDoubleClick={() => onLabelWidthChange(300)}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resizeStart.current = { x: event.clientX, width: labelWidth };
                }}
                onPointerMove={(event) => {
                  if (!resizeStart.current) return;
                  const width = resizeStart.current.width + event.clientX - resizeStart.current.x;
                  onLabelWidthChange(Math.round(Math.max(220, Math.min(520, width))));
                }}
                onPointerUp={(event) => {
                  resizeStart.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onLostPointerCapture={() => { resizeStart.current = null; }}
                onKeyDown={(event) => {
                  const values = { ArrowLeft: labelWidth - 16, ArrowRight: labelWidth + 16, Home: 220, End: 520 };
                  if (!Object.hasOwn(values, event.key)) return;
                  event.preventDefault();
                  onLabelWidthChange(Math.max(220, Math.min(520, values[event.key])));
                }}
              />
            </div>
            <div className="timeline-scale">
              <div className="timeline-months">
                {monthBands.map(({ value, left, width }) => (
                  <span
                    key={value}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {monthLabel(value)}
                  </span>
                ))}
              </div>
              <div className="timeline-weeks">
                {window.weeks.map(({ date, left }) => (
                  <span key={date} style={{ left: `${left}%` }}>
                    {shortDate(date)}
                  </span>
                ))}
              </div>
              {todayPosition != null && (
                <span
                  className="timeline-today-label"
                  style={{ left: `${todayPosition}%` }}
                >
                  오늘
                </span>
              )}
            </div>
          </div>
          {visible.map(({ task, period }) => {
            const assignees = task.assignees.map((assignment) => ({
              userId: assignment.userId,
              name: memberName(members, assignment.userId),
            }));
            const assigneeNames = assignees.map(({ name }) => name).join(' · ');
            const description = `${scheduleLabel(task)} · ${statusLabels[task.status]} · 담당 ${assigneeNames}${period.label ? ` · ${period.label}` : ''}`;
            return (
              <div
                className={`timeline-row${period.overdue ? ' is-late' : ''}`}
                key={task.id}
              >
                <div className="timeline-task-label">
                  <div className="timeline-task-name">
                    <span
                      className={`timeline-task-state schedule-task-${task.status.toLowerCase()}`}
                      title={statusLabels[task.status]}
                      aria-hidden="true"
                    />
                    <span className="timeline-task-id">#{task.id}</span>
                    <button
                      className="task-title-button"
                      {...previewEvents(task, period)}
                      onClick={() => onOpenTask(task.id)}
                    >
                      {task.title}
                    </button>
                  </div>
                  <div className="timeline-task-meta">
                    <span className="timeline-row-dates">
                      {shortDate(taskDate(task.startAt))} –{' '}
                      {shortDate(taskDate(task.dueAt))}
                    </span>
                    {period.label && (
                      <span
                        className={
                          period.overdue
                            ? 'timeline-late-label'
                            : 'timeline-start-label'
                        }
                      >
                        {period.label}
                      </span>
                    )}
                    {!period.planned && (
                      <span className="timeline-carried-label">
                        이전 기간 마감
                      </span>
                    )}
                  </div>
                </div>
                <div className="timeline-track">
                  {monthBands.map(({ value, left, width }) => (
                    <span
                      key={value}
                      className="timeline-month-band"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {window.weeks.map(({ date, left }) => (
                    <span
                      key={date}
                      className="timeline-week-line"
                      style={{ left: `${left}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {period.delay && (
                    <span
                      className="timeline-delay"
                      style={{
                        left: `${period.delay.left}%`,
                        width: `${period.delay.width}%`,
                      }}
                      title={`계획 마감 이후 지연 구간 · ${period.label}`}
                      aria-hidden="true"
                    />
                  )}
                  {period.planned && (
                    <button
                      className={`timeline-period schedule-task-${task.status.toLowerCase()}${period.planned.continuesBefore ? ' continues-before' : ''}${period.planned.continuesAfter ? ' continues-after' : ''}`}
                      style={{
                        left: `${period.planned.left}%`,
                        width: `${period.planned.width}%`,
                      }}
                      aria-label={description}
                      tabIndex={-1}
                      {...previewEvents(task, period)}
                      onClick={() => onOpenTask(task.id)}
                    >
                      <span className="timeline-period-content">
                        {period.planned.continuesBefore && (
                          <span
                            className="timeline-continuation"
                            aria-hidden="true"
                          >
                            ‹
                          </span>
                        )}
                        {period.planned.width >= 4 && (
                          <>
                            <span
                              className="timeline-assignees"
                              aria-hidden="true"
                            >
                              {assignees.slice(0, 2).map(({ userId, name }) => (
                                <span
                                  key={userId}
                                  className="timeline-assignee"
                                  title={name}
                                >
                                  {name
                                    .trim()
                                    .split(/\s+/)
                                    .map((part) => part[0])
                                    .slice(0, 2)
                                    .join('')}
                                </span>
                              ))}
                              {assignees.length > 2 && (
                                <span className="timeline-assignee-more">
                                  +{assignees.length - 2}
                                </span>
                              )}
                            </span>
                            <span
                              className={`timeline-bar-state schedule-task-${task.status.toLowerCase()}`}
                              aria-hidden="true"
                            />
                          </>
                        )}
                        {period.planned.continuesAfter && (
                          <span
                            className="timeline-continuation"
                            aria-hidden="true"
                          >
                            ›
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                  {todayPosition != null && (
                    <span
                      className="timeline-today-line"
                      style={{ left: `${todayPosition}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {preview && createPortal(
        <div
          id={previewId}
          role="tooltip"
          ref={(element) => {
            if (!element) return;
            const bounds = element.getBoundingClientRect();
            const anchorBounds = preview.anchor.getBoundingClientRect();
            const top = anchorBounds.bottom + bounds.height + 20 <= globalThis.innerHeight
              ? anchorBounds.bottom + 8
              : anchorBounds.top - bounds.height - 8;
            element.style.top = `${Math.max(12, Math.min(top, globalThis.innerHeight - bounds.height - 12))}px`;
          }}
          className="timeline-preview"
          style={{ left: preview.left, top: preview.top, width: preview.width }}
          onMouseEnter={cancelClose}
          onMouseLeave={closePreview}
        >
          <span className={`status-badge task-state-${preview.task.status.toLowerCase()}`}>
            {statusLabels[preview.task.status]}
          </span>
          <strong>#{preview.task.id} {preview.task.title}</strong>
          <dl>
            <div>
              <dt>담당</dt>
              <dd>{preview.task.assignees.map(({ userId }) => memberName(members, userId)).join(' · ')}</dd>
            </div>
            <div><dt>시작일</dt><dd>{formatDate(preview.task.startAt)}</dd></div>
            <div><dt>마감일</dt><dd>{formatDate(preview.task.dueAt)}</dd></div>
          </dl>
          {previewPeriod?.label && (
            <span className={previewPeriod.overdue ? 'timeline-late-label' : 'timeline-start-label'}>
              {previewPeriod.label}
            </span>
          )}
        </div>, document.body,
      )}
      <details className="task-schedule-help">
        <summary>타임라인 읽는 법</summary>
        <p>막대의 위치와 겹침으로 일정의 순서와 병행 구간을 비교합니다. 막대는 계획 기간, 빨간 점선은 마감 이후 오늘까지의 지연 구간입니다. 완료 작업은 지연 집계에서 제외합니다. 작업 제목이나 막대를 선택하면 상세를 확인할 수 있습니다.</p>
      </details>
    </section>
  );
}

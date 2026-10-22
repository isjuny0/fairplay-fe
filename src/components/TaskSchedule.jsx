import { koreanDateTime } from '../lib/koreanTime.js';
import { Fragment, useRef, useState } from 'react';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskMonthDays,
  taskDateMarkers,
  tasksByDate,
  calendarWeekTasks,
  timelineTaskPeriod,
  timelineWindow,
} from '../lib/taskSchedule.js';
import { Modal } from './ui.jsx';
import TaskSchedulePreview, { useTaskSchedulePreview } from './TaskSchedulePreview.jsx';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const monthLabel = (month) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
const shortDate = (date) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(-2))}`;
const scheduleLabel = (task) =>
  `${task.title} · 시작일 ${formatDate(task.startAt)} · 마감 ${formatDate(task.dueAt)}`;

function ScheduleHelp({ text }) {
  return (
    <span
      className="schedule-help-trigger"
      tabIndex={0}
      aria-label={`일정 읽는 법 도움말: ${text}`}
    >
      <span aria-hidden="true">?</span>
      <span className="schedule-help-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function ScheduleStatusLegend({ label }) {
  return (
    <div className="timeline-legend" aria-label={label}>
      {Object.entries(statusLabels).map(([status, statusLabel]) => (
        <span
          key={status}
          className={`schedule-task-${status.toLowerCase()}`}
        >
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      ))}
    </div>
  );
}

export function MonthNavigation({
  month,
  onMonthChange,
  tasks,
  span = 1,
  helpText,
}) {
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
      <div className="task-month-picker">
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
        {helpText && <ScheduleHelp text={helpText} />}
      </div>
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
  summary,
  now,
  tasks,
  month,
  onOpenTask,
  members,
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const previewController = useTaskSchedulePreview(tasks, month);
  const openDate = (date) => {
    previewController.dismissPreview();
    setSelectedDate(date);
  };
  const days = taskMonthDays(month);
  const ongoingTasks = tasks.filter((task) => task.status !== 'DONE');
  const markersByDate = taskDateMarkers(
    tasks.filter((task) => task.status === 'DONE'),
    days,
  );
  const ongoingByDate = tasksByDate(ongoingTasks, days);
  const tasksOnDate = (date) => [
    ...new Map([
      ...(ongoingByDate.get(date) || []).map((task) => [task.id, task]),
      ...(markersByDate.get(date) || []).map(({ task }) => [task.id, task]),
    ]).values(),
  ];
  const today = taskDate(koreanDateTime(now));
  return (
    <section className="task-schedule" aria-label="작업 캘린더">
      <div className="calendar-overview">
        {summary}
        <div className="calendar-legends">
          <div
            className="calendar-event-legend"
            aria-label="캘린더 시작·마감 범례"
          >
            <span>
              <span
                className="calendar-event-symbol is-start"
                aria-hidden="true"
              />
              완료 시작
            </span>
            <span>
              <span
                className="calendar-event-symbol is-due"
                aria-hidden="true"
              />
              완료 마감
            </span>
          </div>
          <ScheduleStatusLegend label="캘린더 상태 범례" />
        </div>
      </div>
      <div
        className="task-calendar-scroll"
        role="region"
        aria-label="월간 작업 일정"
        tabIndex={0}
      >
        <table
          className="task-calendar-table"
          aria-label={`${monthLabel(month)} 작업 일정`}
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
              const segments = calendarWeekTasks(ongoingTasks, dates);
              const lanes = Math.max(
                2,
                ...segments.map(({ lane }) => lane + 1),
              );
              return (
                <Fragment key={week}>
                  <tr className="calendar-dates">
                    {dates.map((date, index) => {
                      const markers = markersByDate.get(date) || [];
                      const dateTasks = date ? tasksOnDate(date) : [];
                      const dateLabel = date && (
                        <time
                          dateTime={date}
                          aria-current={date === today ? 'date' : undefined}
                        >
                          {Number(date.slice(-2))}
                        </time>
                      );
                      return (
                        <td
                          key={date || `empty-${index}`}
                          className={date === today ? 'is-today' : ''}
                          aria-label={date ? `${date} 작업 일정` : undefined}
                        >
                          {date && (
                            <div className="calendar-date-header">
                              {dateTasks.length ? (
                                <button
                                  className="calendar-date-open"
                                  aria-label={`${date} 작업 ${dateTasks.length}개 보기`}
                                  onClick={() => openDate(date)}
                                >
                                  {dateLabel}
                                </button>
                              ) : (
                                dateLabel
                              )}
                              {!!markers.length && (
                                <span
                                  className="calendar-marker-list"
                                  aria-label="완료 작업 시작·마감"
                                >
                                  {markers.map(({ task, type }) => (
                                    <button
                                      key={`${task.id}-${type}`}
                                      className={`calendar-date-marker is-${type} schedule-task-done`}
                                      aria-label={`${task.title} · ${type === 'start' ? '시작' : '마감'} · 완료`}
                                      {...previewController.previewEvents(
                                        task,
                                        type,
                                      )}
                                      onClick={() => openDate(date)}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="calendar-period-row">
                    <td colSpan={7}>
                      <div
                        className="calendar-week-periods"
                        style={{ '--calendar-lanes': lanes }}
                      >
                        {dates.map((date, index) => (
                          <span
                            key={date || `empty-${index}`}
                            className={`calendar-period-day${date === today ? ' is-today' : ''}`}
                            style={{ gridColumn: index + 1, gridRow: '1 / -1' }}
                            aria-hidden="true"
                          />
                        ))}
                        {segments.map(
                          ({
                            task,
                            startColumn,
                            endColumn,
                            lane,
                            continuesBefore,
                            continuesAfter,
                          }) => (
                            <button
                              key={task.id}
                              className={`calendar-period schedule-task-${task.status.toLowerCase()}${continuesBefore ? ' continues-before' : ''}${continuesAfter ? ' continues-after' : ''}`}
                              style={{
                                gridColumn: `${startColumn} / ${endColumn + 1}`,
                                gridRow: lane + 1,
                              }}
                              aria-label={`${task.title} · 작업 기간 · ${statusLabels[task.status]}`}
                              {...previewController.previewEvents(
                                task,
                                'period',
                              )}
                              onClick={() => {
                                previewController.dismissPreview();
                                onOpenTask(task.id);
                              }}
                            />
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <TaskSchedulePreview
        controller={previewController}
        members={members}
        now={now}
        variant="calendar"
      />
      {selectedDate && (
        <Modal
          title={`${selectedDate} 작업 일정`}
          onClose={() => setSelectedDate(null)}
        >
          <div className="stack">
            {tasksOnDate(selectedDate).map((task) => (
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
  const previewController = useTaskSchedulePreview(tasks, month);
  const { previewEvents } = previewController;
  const resizeStart = useRef(null);
  const window = timelineWindow(month);
  const visible = tasks
    .map((task) => ({ task, period: timelineTaskPeriod(task, window, now) }))
    .filter(({ period }) => period);
  const today = taskDate(koreanDateTime(now));
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
        <ScheduleStatusLegend label="타임라인 상태 범례" />
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
                      {...previewEvents(task)}
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
                      {...previewEvents(task)}
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
      <TaskSchedulePreview controller={previewController} members={members} now={now} variant="timeline" />
    </section>
  );
}

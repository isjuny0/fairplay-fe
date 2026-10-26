import { koreanDateTime } from '../lib/koreanTime.js';
import { useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  timelineTaskPeriod,
  timelineWindow,
} from '../lib/taskSchedule.js';
import TaskSchedulePreview, { useTaskSchedulePreview } from './TaskSchedulePreview.jsx';

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

export function TimelineNavigation({
  month,
  onMonthChange,
  tasks,
  helpText,
}) {
  const previous = moveTaskMonth(month, -3),
    next = moveTaskMonth(month, 3);
  const nearest = nearestTaskMonth(tasks);
  const lastMonth = timelineWindow(month).months.at(-1);
  return (
    <div className="task-month-navigation">
      <div className="heading-actions">
        <button
          className="secondary-button"
          aria-label="이전 3개월"
          disabled={!previous}
          onClick={() => onMonthChange(previous)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <label className="task-month-select">
          <span aria-hidden="true">
            {monthLabel(month)}
            {lastMonth !== month
              ? ` – ${monthLabel(lastMonth)}`
              : ''}
            <ChevronDown size={14} aria-hidden="true" />
          </span>
          <input
            aria-label="조회 시작 월"
            type="month"
            min="0001-01"
            max="9999-12"
            value={month}
            onClick={(event) => {
              try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard editing remains available. */ }
            }}
            onChange={(event) => {
              if (isTaskMonth(event.target.value))
                onMonthChange(event.target.value);
            }}
          />
        </label>
        <button
          className="secondary-button"
          aria-label="다음 3개월"
          disabled={!next}
          onClick={() => onMonthChange(next)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          className="secondary-button"
          onClick={() => onMonthChange(currentTaskMonth())}
        >
          오늘
        </button>
      </div>
      {helpText && <ScheduleHelp text={helpText} />}
      {nearest && nearest !== month && (
        <button className="text-button" onClick={() => onMonthChange(nearest)}>
          가까운 마감으로
        </button>
      )}
    </div>
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
      <TaskSchedulePreview controller={previewController} members={members} now={now} />
    </section>
  );
}

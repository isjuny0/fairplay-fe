import { koreanDateTime } from '../lib/koreanTime.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  taskDate,
  timelineTaskPeriod,
  timelineWindow,
} from '../lib/taskSchedule.js';
import TaskSchedulePreview, { TaskScheduleTouchPreview, useTaskSchedulePreview } from './TaskSchedulePreview.jsx';
import useMobileLayout from '../hooks/useMobileLayout.js';

const monthLabel = (month) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;
const shortDate = (date) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(-2))}`;
const scheduleLabel = (task) =>
  `${task.title} · 시작일 ${formatDate(task.startAt)} · 마감 ${formatDate(task.dueAt)}`;

export function TimelineNavigation({
  month,
  monthCount = 1,
  onMonthChange,
}) {
  const previous = moveTaskMonth(month, -1),
    next = moveTaskMonth(month, 1);
  const lastMonth = timelineWindow(month, monthCount).months.at(-1);
  return (
    <div className="task-month-navigation">
      <div className="heading-actions">
        <button
          className="secondary-button"
          aria-label="이전 1개월"
          disabled={!previous}
          onClick={() => onMonthChange(previous)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <label className="task-month-select">
          <span aria-hidden="true">
            <span className="schedule-month-label-long">{monthLabel(month)}
            {lastMonth !== month
              ? ` – ${monthLabel(lastMonth)}`
              : ''}</span>
            <span className="schedule-month-label-short">{Number(month.slice(0, 4))}.{Number(month.slice(5))}{lastMonth !== month ? `–${Number(lastMonth.slice(0, 4))}.${Number(lastMonth.slice(5))}` : ''}</span>
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
          aria-label="다음 1개월"
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

    </div>
  );
}

export function TaskTimeline({
  now,
  tasks,
  month,
  monthCount = 1,
  onOpenTask,
  members,
  emptyState,
}) {
  const previewController = useTaskSchedulePreview(tasks, `${month}:${monthCount}`);
  const { previewEvents } = previewController;
  const mobile = useMobileLayout('(max-width: 720px)');
  const [touchTaskId, setTouchTaskId] = useState(null);
  useEffect(() => setTouchTaskId(null), [mobile, month, monthCount]);
  const openTask = (event, taskId) => {
    if (mobile) {
      event.currentTarget.focus({ preventScroll: true });
      setTouchTaskId(taskId);
    } else onOpenTask(taskId);
  };
  const [trackWidth, setTrackWidth] = useState(0);
  const scrollRegion = useRef(null);
  useLayoutEffect(() => {
    const region = scrollRegion.current;
    if (!region) return;
    const header = region.querySelector('.timeline-header');
    const viewport = region.ownerDocument.defaultView;
    let frame = null;
    const update = () => {
      frame = null;
      const topbarBottom = Math.max(0, document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0);
      const bounds = region.getBoundingClientRect();
      // The clipped track needs an explicit sticky offset while the page scrolls.
      setTrackWidth(Math.max(0, region.clientWidth - 24));
      const offset = Math.max(0,
        Math.min(topbarBottom - bounds.top - region.clientTop, region.clientHeight - header.offsetHeight));
      region.style.setProperty('--timeline-header-offset', `${offset}px`);
    };
    const schedule = () => { if (frame == null) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(region);
    observer.observe(header);
    const topbar = document.querySelector('.topbar');
    if (topbar) observer.observe(topbar);
    viewport.addEventListener('scroll', schedule, true);
    viewport.addEventListener('resize', schedule);
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', schedule, true);
      viewport.removeEventListener('resize', schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);
  const window = timelineWindow(month, monthCount);
  const weekWidth = trackWidth * 7 / window.dayCount;
  const tickStep = Math.max(1, Math.ceil(56 / Math.max(1, weekWidth)));
  const ticks = window.weeks.filter((_, index) => index % tickStep === 0);
  const visible = tasks
    .map((task) => ({ task, period: timelineTaskPeriod(task, window, now) }))
    .filter(({ period }) => period);
  const touchTask = mobile && visible.find(({ task }) => task.id === touchTaskId)?.task;
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
  return (
    <section className="task-schedule" data-month-count={monthCount} aria-label="작업 타임라인">
      <div
        ref={scrollRegion}
        className="task-timeline-scroll"
        role="region"
        aria-label="작업 계획 타임라인"
        tabIndex={0}
      >
        <div className="task-timeline">
          <div className="timeline-row timeline-header">
            <div className={`timeline-scale${todayPosition != null ? ' has-today' : ''}`}>
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
                {ticks.map(({ date, left }) => (
                  <span key={date} style={{ left: `clamp(20px, ${left}%, calc(100% - 20px))` }}>
                    {shortDate(date)}
                  </span>
                ))}
              </div>
              {todayPosition != null && (
                <span
                  className="timeline-today-label"
                  style={{ left: `clamp(18px, ${todayPosition}%, calc(100% - 18px))` }}
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
                    <button
                      className="task-title-button" data-guide-task-id={task.id}
                      aria-haspopup={mobile ? 'dialog' : undefined}
                      aria-expanded={mobile ? touchTaskId === task.id : undefined}
                      {...(!mobile ? previewEvents(task) : {})}
                      onClick={(event) => openTask(event, task.id)}
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
                  {ticks.map(({ date, left }) => (
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
                      tabIndex={mobile ? 0 : -1}
                      aria-haspopup={mobile ? 'dialog' : undefined}
                      aria-expanded={mobile ? touchTaskId === task.id : undefined}
                      {...(!mobile ? previewEvents(task) : {})}
                      onClick={(event) => openTask(event, task.id)}
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
                        <span className="timeline-assignees" aria-hidden="true">
                          {assignees.slice(0, 2).map(({ userId, name }) => (
                            <span className="timeline-assignee" key={userId} title={name}>{name.slice(0, 1)}</span>
                          ))}
                          {assignees.length > 2 && <span className="timeline-assignee-more">+{assignees.length - 2}</span>}
                        </span>
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
        {visible.length === 0 && emptyState}
      </div>
      {!mobile && <TaskSchedulePreview controller={previewController} members={members} now={now} />}
      {touchTask && <TaskScheduleTouchPreview task={touchTask} members={members} now={now}
        onClose={() => setTouchTaskId(null)} onOpenTask={onOpenTask} />}
    </section>
  );
}

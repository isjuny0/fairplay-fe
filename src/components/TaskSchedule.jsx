import { Fragment, useState } from 'react';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  calendarWeekTasks,
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskMonthDays,
  tasksByDate,
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

function MonthNavigation({ month, onMonthChange, tasks, span = 1 }) {
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
        {span === 3 ? '조회 시작 월' : '조회 월'}{' '}
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
  tasks,
  month,
  onMonthChange,
  onOpenTask,
  members,
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const days = taskMonthDays(month),
    byDate = tasksByDate(tasks, days);
  const today = taskDate(new Date().toISOString());
  const count = new Set([...byDate.values()].flat().map((task) => task.id))
    .size;
  return (
    <section className="task-schedule" aria-label="작업 캘린더">
      <MonthNavigation
        month={month}
        onMonthChange={onMonthChange}
        tasks={tasks}
      />
      <p className="field-help">
        시작일부터 마감일까지 · 이번 달 {count}개 작업 · 날짜별 작업 수를
        선택하면 전체 작업을 확인할 수 있습니다.
      </p>
      {!count && (
        <p className="notice">
          이 달에 예정된 작업이 없습니다. 다른 달을 선택하거나 검색·필터 조건을
          확인하세요.
        </p>
      )}
      <div
        className="task-calendar-scroll"
        role="region"
        aria-label="월간 작업 일정"
        tabIndex={0}
      >
        <table
          className="task-calendar-table"
          aria-label={`${monthLabel(month)} 작업 기간 일정`}
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
              const segments = calendarWeekTasks(tasks, dates);
              return (
                <Fragment key={week}>
                  <tr className="calendar-dates">
                    {dates.map((date, index) => (
                      <td
                        key={date || `empty-${index}`}
                        className={date === today ? 'is-today' : ''}
                        aria-label={date ? `${date} 작업 일정` : undefined}
                      >
                        {date && (
                          <>
                            <time
                              dateTime={date}
                              aria-current={date === today ? 'date' : undefined}
                            >
                              {Number(date.slice(-2))}
                            </time>
                            {!!byDate.get(date)?.length && (
                              <button
                                className="calendar-count"
                                aria-label={`${date} 작업 ${byDate.get(date).length}개 모두 보기`}
                                onClick={() => setSelectedDate(date)}
                              >
                                {byDate.get(date).length}개
                                {segments.some(
                                  (segment) =>
                                    segment.lane >= 3 &&
                                    segment.startColumn <= index + 1 &&
                                    segment.endColumn >= index + 1,
                                )
                                  ? ' 모두'
                                  : ''}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="calendar-period-row">
                    <td colSpan={7}>
                      <div className="calendar-week-periods">
                        {dates.map((date, index) => (
                          <div
                            key={index}
                            className={`calendar-period-day ${date === today ? 'is-today' : ''}`}
                            style={{ gridColumn: index + 1, gridRow: '1 / 4' }}
                          />
                        ))}
                        {segments
                          .filter(({ lane }) => lane < 3)
                          .map(
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
                                aria-label={task.title}
                                aria-description={scheduleLabel(task)}
                                title={scheduleLabel(task)}
                                onClick={() => onOpenTask(task.id)}
                              >
                                {continuesBefore && (
                                  <span aria-hidden="true">← </span>
                                )}
                                <span className="calendar-period-title">
                                  {task.title}
                                </span>
                                {continuesAfter && (
                                  <span aria-hidden="true"> →</span>
                                )}
                              </button>
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
      {selectedDate && (
        <Modal
          title={`${selectedDate} 작업 일정`}
          onClose={() => setSelectedDate(null)}
        >
          <div className="stack">
            {(byDate.get(selectedDate) || []).map((task) => (
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
  tasks,
  month,
  onMonthChange,
  onOpenTask,
  members,
  sortLabel,
}) {
  const window = timelineWindow(month),
    now = Date.now();
  const visible = tasks
    .map((task) => ({ task, period: timelineTaskPeriod(task, window, now) }))
    .filter(({ period }) => period);
  const today = taskDate(new Date(now).toISOString());
  const todayPosition =
    today >= window.first && today <= window.last
      ? window.position(today) + 50 / window.dayCount
      : null;
  const lateCount = visible.filter(({ period }) => period.overdue).length;
  const startPassedCount = visible.filter(
    ({ period }) => period.startPassed,
  ).length;
  return (
    <section className="task-schedule" aria-label="작업 타임라인">
      <MonthNavigation
        month={month}
        onMonthChange={onMonthChange}
        tasks={tasks}
        span={3}
      />
      <div className="timeline-summary" aria-label="조회 기간 작업 현황">
        <span>
          기간 내 작업 <strong>{visible.length}</strong>
        </span>
        <span className={lateCount ? 'is-overdue' : ''}>
          마감 지남 <strong>{lateCount}</strong>
        </span>
        <span>
          시작 예정일 지남 <strong>{startPassedCount}</strong>
        </span>
      </div>
      <p className="field-help">
        {sortLabel} · 막대의 위치와 겹침으로 일정 순서를 비교하세요.
      </p>
      <div
        className="task-timeline-scroll"
        role="region"
        aria-label="작업 계획 타임라인"
        tabIndex={0}
      >
        <div className="task-timeline">
          <div className="timeline-row timeline-header">
            <div className="timeline-task-label">작업 · {sortLabel}</div>
            <div className="timeline-scale">
              <div className="timeline-months">
                {window.months.map((value, index) => {
                  const first = `${value}-01`,
                    next = window.months[index + 1];
                  return (
                    <span
                      key={value}
                      style={{
                        left: `${window.position(first)}%`,
                        width: `${next ? window.position(`${next}-01`) - window.position(first) : 100 - window.position(first)}%`,
                      }}
                    >
                      {monthLabel(value)}
                    </span>
                  );
                })}
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
            const description = `${scheduleLabel(task)}${period.label ? ` · ${period.label}` : ''}`;
            return (
              <div
                className={`timeline-row${period.overdue ? ' is-late' : ''}`}
                key={task.id}
              >
                <div className="timeline-task-label">
                  <button
                    className="task-title-button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    {task.title}
                  </button>
                  <span className="field-help">
                    {statusLabels[task.status]} ·{' '}
                    {task.assignees
                      .map((assignment) =>
                        memberName(members, assignment.userId),
                      )
                      .join(' · ')}
                  </span>
                  <span className="timeline-row-dates">
                    {shortDate(taskDate(task.startAt))} –{' '}
                    {shortDate(taskDate(task.dueAt))}
                    {!period.planned ? ' · 이전 기간 마감' : ''}
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
                </div>
                <div className="timeline-track">
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
                      title={description}
                      onClick={() => onOpenTask(task.id)}
                    >
                      {period.planned.continuesBefore && (
                        <span aria-hidden="true">← </span>
                      )}
                      <span className="timeline-period-title">
                        {task.title}
                      </span>
                      {period.planned.continuesAfter && (
                        <span aria-hidden="true"> →</span>
                      )}
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
      {!visible.length && (
        <p className="notice">
          이 기간에 예정되거나 지연 중인 작업이 없습니다. 다른 기간을 선택하거나
          검색·필터 조건을 확인하세요.
        </p>
      )}
      <p className="field-help">
        막대는 계획 기간, 빨간 점선은 마감 이후 오늘까지의 지연 구간입니다. 완료
        작업은 지연 집계에서 제외합니다. 작업 제목이나 막대를 선택하면 상세를
        확인할 수 있습니다.
      </p>
    </section>
  );
}

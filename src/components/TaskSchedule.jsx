import { useState } from 'react';
import { daysInMonth } from '../lib/dateTime.js';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import {
  currentTaskMonth,
  isTaskMonth,
  moveTaskMonth,
  nearestTaskMonth,
  taskDate,
  taskMonthDays,
  taskMonthRange,
  tasksByDate,
} from '../lib/taskSchedule.js';
import { Modal } from './ui.jsx';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const monthLabel = (month) =>
  `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`;

function MonthNavigation({ month, onMonthChange, tasks }) {
  const previous = moveTaskMonth(month, -1),
    next = moveTaskMonth(month, 1);
  const nearest = nearestTaskMonth(tasks);
  return (
    <div className="task-month-navigation">
      <div className="heading-actions">
        <button
          className="secondary-button"
          aria-label="이전 달"
          disabled={!previous}
          onClick={() => onMonthChange(previous)}
        >
          ←
        </button>
        <h2>{monthLabel(month)}</h2>
        <button
          className="secondary-button"
          aria-label="다음 달"
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
        조회 월{' '}
        <input
          aria-label="조회 월"
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

function ScheduleTask({ task, onOpenTask, detailed = false, members }) {
  return (
    <button
      className={`schedule-task schedule-task-${task.status.toLowerCase()}`}
      onClick={() => onOpenTask(task.id)}
      title={`${task.title} · ${statusLabels[task.status]} · 시작일 ${formatDate(task.startAt)} · 마감 ${formatDate(task.dueAt)}`}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="schedule-task-title">{task.title}</span>
      {detailed && (
        <>
          <span>
            {statusLabels[task.status]} · 시작일 {formatDate(task.startAt)} ·
            마감 {formatDate(task.dueAt)}
          </span>
          <span>
            담당{' '}
            {task.assignees
              .map((assignment) => memberName(members, assignment.userId))
              .join(' · ')}
          </span>
        </>
      )}
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
  const byDate = tasksByDate(tasks),
    days = taskMonthDays(month);
  const today = taskDate(new Date().toISOString());
  const count = tasks.filter((task) =>
    taskDate(task.dueAt).startsWith(month),
  ).length;
  return (
    <section className="task-schedule" aria-label="작업 캘린더">
      <MonthNavigation
        month={month}
        onMonthChange={onMonthChange}
        tasks={tasks}
      />
      <p className="field-help">마감일 기준 · 이번 달 {count}개 작업</p>
      {!count && (
        <p className="notice">
          이 달에 마감되는 작업이 없습니다. 다른 달을 선택하거나 검색·필터
          조건을 확인하세요.
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
          aria-label={`${monthLabel(month)} 작업 마감 일정`}
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
            {Array.from({ length: days.length / 7 }, (_, week) => (
              <tr key={week}>
                {days.slice(week * 7, week * 7 + 7).map((date, index) => (
                  <td
                    key={date || `empty-${index}`}
                    className={date === today ? 'is-today' : ''}
                    aria-label={date ? `${date} 마감 작업` : undefined}
                  >
                    {date && (
                      <>
                        <time
                          dateTime={date}
                          aria-current={date === today ? 'date' : undefined}
                        >
                          {Number(date.slice(-2))}
                        </time>
                        <div className="calendar-day-tasks">
                          {(byDate.get(date) || []).slice(0, 3).map((task) => (
                            <ScheduleTask
                              key={task.id}
                              task={task}
                              onOpenTask={onOpenTask}
                            />
                          ))}
                        </div>
                        {(byDate.get(date)?.length || 0) > 3 && (
                          <button
                            className="text-button calendar-more"
                            aria-label={`${date} 작업 ${byDate.get(date).length}개 모두 보기`}
                            onClick={() => setSelectedDate(date)}
                          >
                            + {byDate.get(date).length - 3}개 더보기
                          </button>
                        )}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedDate && (
        <Modal
          title={`${selectedDate} 마감 작업`}
          onClose={() => setSelectedDate(null)}
        >
          <div className="stack">
            {(byDate.get(selectedDate) || []).map((task) => (
              <ScheduleTask
                key={task.id}
                task={task}
                onOpenTask={onOpenTask}
                detailed
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
}) {
  const [year, number] = month.split('-').map(Number);
  const days = Array.from(
    { length: daysInMonth(year, number - 1) },
    (_, index) => index + 1,
  );
  const visible = tasks
    .map((task) => ({ task, range: taskMonthRange(task, month) }))
    .filter(({ range }) => range);
  const today = taskDate(new Date().toISOString());
  return (
    <section className="task-schedule" aria-label="작업 타임라인">
      <MonthNavigation
        month={month}
        onMonthChange={onMonthChange}
        tasks={tasks}
      />
      <p className="field-help">
        시작일부터 마감일까지의 계획 일정 · 이번 달과 겹치는 작업을 표시합니다.
      </p>
      <div
        className="task-timeline-scroll"
        role="region"
        aria-label="작업 계획 타임라인"
        tabIndex={0}
      >
        <div
          className="task-timeline"
          style={{ '--timeline-days': days.length }}
        >
          <div className="timeline-row timeline-header">
            <div className="timeline-task-label">
              작업 · 이번 달 {visible.length}개
            </div>
            {days.map((day) => (
              <div
                className={`timeline-day ${`${month}-${String(day).padStart(2, '0')}` === today ? 'is-today' : ''}`}
                style={{ gridColumn: day + 1 }}
                key={day}
              >
                {day}
              </div>
            ))}
          </div>
          {visible.map(({ task, range }) => {
            const scheduleLabel = `${task.title} · 시작일 ${formatDate(task.startAt)} · 마감 ${formatDate(task.dueAt)}`;
            return (
              <div className="timeline-row" key={task.id}>
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
                </div>
                {days.map((day) => (
                  <div
                    className={`timeline-day ${`${month}-${String(day).padStart(2, '0')}` === today ? 'is-today' : ''}`}
                    style={{ gridColumn: day + 1 }}
                    key={day}
                  />
                ))}
                <button
                  className={`timeline-period schedule-task-${task.status.toLowerCase()}${range.continuesBefore ? ' continues-before' : ''}${range.continuesAfter ? ' continues-after' : ''}`}
                  style={{
                    gridColumn: `${range.startDay + 1} / ${range.endDay + 2}`,
                    gridRow: 1,
                  }}
                  aria-label={scheduleLabel}
                  title={scheduleLabel}
                  onClick={() => onOpenTask(task.id)}
                >
                  <>
                    {range.continuesBefore && (
                      <span aria-hidden="true">← </span>
                    )}
                    <span className="timeline-period-title">{task.title}</span>
                    {range.continuesAfter && <span aria-hidden="true"> →</span>}
                  </>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {!visible.length && (
        <p className="notice">
          이 달에 예정된 작업이 없습니다. 다른 달을 선택하거나 검색·필터 조건을
          확인하세요.
        </p>
      )}
      <p className="field-help">
        막대는 시작일부터 마감일까지의 계획 기간입니다. 작업 제목이나 일정
        표시를 선택하면 상세를 확인할 수 있습니다.
      </p>
    </section>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import { taskScheduleStatus } from '../lib/taskSchedule.js';

export function useTaskSchedulePreview(tasks, month) {
  const [preview, setPreview] = useState(null);
  const previewId = useId();
  const closeTimer = useRef(null);
  const hoverTimer = useRef(null);
  const previousSchedule = useRef({ tasks, month });
  const cancelHover = () => clearTimeout(hoverTimer.current);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const dismissPreview = () => {
    cancelClose();
    cancelHover();
    setPreview(null);
  };
  const closePreview = () => {
    cancelClose();
    cancelHover();
    closeTimer.current = setTimeout(() => {
      setPreview((current) =>
        document.activeElement === current?.anchor ? current : null,
      );
    }, 120);
  };
  const showPreview = (anchor, task, markerType) => {
    cancelHover();
    cancelClose();
    const bounds = anchor.getBoundingClientRect();
    const width = Math.min(320, globalThis.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(bounds.left, globalThis.innerWidth - width - 12),
    );
    setPreview({
      task,
      markerType,
      anchor,
      left,
      top: bounds.bottom + 8,
      width,
      anchorLeft: bounds.left,
      anchorBottom: bounds.bottom,
    });
  };
  const previewEvents = (task, markerType = null) => ({
    'aria-describedby':
      preview?.task.id === task.id && preview.markerType === markerType
        ? previewId
        : undefined,
    onMouseEnter: (event) => {
      cancelHover();
      cancelClose();
      const anchor = event.currentTarget;
      hoverTimer.current = setTimeout(
        () => showPreview(anchor, task, markerType),
        200,
      );
    },
    onMouseLeave: (event) => {
      cancelHover();
      if (document.activeElement !== event.currentTarget) closePreview();
    },
    onFocus: (event) => showPreview(event.currentTarget, task, markerType),
    onBlur: closePreview,
  });
  useEffect(() => {
    const dismiss = (event) => {
      if (
        event?.target instanceof Element &&
        event.target.closest('.task-schedule-preview')
      )
        return;
      clearTimeout(closeTimer.current);
      clearTimeout(hoverTimer.current);
      setPreview((current) => {
        if (event?.type === 'scroll' && current) {
          const bounds = current.anchor.getBoundingClientRect();
          // Focus may queue a scroll event before this preview is positioned.
          if (
            bounds.left === current.anchorLeft &&
            bounds.bottom === current.anchorBottom
          )
            return current;
        }
        return null;
      });
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
    const sameTasks =
      previous.tasks.length === tasks.length &&
      previous.tasks.every((task, index) => task === tasks[index]);
    if (previous.month === month && sameTasks) return;
    clearTimeout(hoverTimer.current);
    clearTimeout(closeTimer.current);
    setPreview(null);
  }, [tasks, month]);
  return {
    preview,
    previewId,
    previewEvents,
    cancelClose,
    closePreview,
    dismissPreview,
  };
}

export default function TaskSchedulePreview({
  controller,
  members,
  now,
  variant,
}) {
  const { preview, previewId, cancelClose, closePreview } = controller;
  if (!preview) return null;
  const status = taskScheduleStatus(preview.task, now);
  return createPortal(
    <div
      id={previewId}
      role="tooltip"
      ref={(element) => {
        if (!element) return;
        const bounds = element.getBoundingClientRect();
        const anchorBounds = preview.anchor.getBoundingClientRect();
        const top =
          anchorBounds.bottom + bounds.height + 20 <= globalThis.innerHeight
            ? anchorBounds.bottom + 8
            : anchorBounds.top - bounds.height - 8;
        element.style.top = `${Math.max(12, Math.min(top, globalThis.innerHeight - bounds.height - 12))}px`;
      }}
      className={`task-schedule-preview ${variant}-preview`}
      style={{ left: preview.left, top: preview.top, width: preview.width }}
      onMouseEnter={cancelClose}
      onMouseLeave={closePreview}
    >
      <div className="task-schedule-preview-heading">
        <span
          className={`status-badge task-state-${preview.task.status.toLowerCase()}`}
        >
          {statusLabels[preview.task.status]}
        </span>
        {preview.markerType && (
          <span className="calendar-preview-kind">
            <span
              className={`calendar-event-symbol is-${preview.markerType}`}
              aria-hidden="true"
            />
            {
              { start: '시작 일정', due: '마감 일정', period: '작업 기간' }[
                preview.markerType
              ]
            }
          </span>
        )}
      </div>
      <strong>
        #{preview.task.id} {preview.task.title}
      </strong>
      <dl>
        <div>
          <dt>담당</dt>
          <dd>
            {preview.task.assignees
              .map(({ userId }) => memberName(members, userId))
              .join(' · ')}
          </dd>
        </div>
        <div>
          <dt>시작일</dt>
          <dd>{formatDate(preview.task.startAt)}</dd>
        </div>
        <div>
          <dt>마감일</dt>
          <dd>{formatDate(preview.task.dueAt)}</dd>
        </div>
      </dl>
      {status.label && (
        <span
          className={
            status.overdue ? 'timeline-late-label' : 'timeline-start-label'
          }
        >
          {status.label}
        </span>
      )}
    </div>,
    document.body,
  );
}

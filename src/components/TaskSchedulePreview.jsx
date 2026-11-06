import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate, memberName, statusLabels } from '../lib/domain.js';
import { taskScheduleStatus } from '../lib/taskSchedule.js';
import { Modal } from './ui.jsx';

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
  const showPreview = (anchor, task) => {
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
      anchor,
      left,
      top: bounds.bottom + 8,
      width,
      anchorLeft: bounds.left,
      anchorBottom: bounds.bottom,
    });
  };
  const previewEvents = (task) => ({
    'aria-describedby':
      preview?.task.id === task.id
        ? previewId
        : undefined,
    onMouseEnter: (event) => {
      cancelHover();
      cancelClose();
      const anchor = event.currentTarget;
      hoverTimer.current = setTimeout(
        () => showPreview(anchor, task),
        200,
      );
    },
    onMouseLeave: (event) => {
      cancelHover();
      if (document.activeElement !== event.currentTarget) closePreview();
    },
    onFocus: (event) => showPreview(event.currentTarget, task),
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
}) {
  const { preview, previewId, cancelClose, closePreview } = controller;
  if (!preview) return null;
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
      className="task-schedule-preview timeline-preview"
      style={{ left: preview.left, top: preview.top, width: preview.width }}
      onMouseEnter={cancelClose}
      onMouseLeave={closePreview}
    >
      <TaskPreviewContent task={preview.task} members={members} now={now} />
    </div>,
    document.body,
  );
}

function TaskPreviewContent({ task, members, now }) {
  const status = taskScheduleStatus(task, now);
  return <>
      <div className="task-schedule-preview-heading">
        <span
          className={`status-badge task-state-${task.status.toLowerCase()}`}
        >
          {statusLabels[task.status]}
        </span>
      </div>
      <strong>
        {task.title}
      </strong>
      <dl>
        <div>
          <dt>담당</dt>
          <dd>
            {task.assignees
              .map(({ userId }) => memberName(members, userId))
              .join(' · ')}
          </dd>
        </div>
        <div>
          <dt>시작일</dt>
          <dd>{formatDate(task.startAt)}</dd>
        </div>
        <div>
          <dt>마감일</dt>
          <dd>{formatDate(task.dueAt)}</dd>
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
  </>;
}

export function TaskScheduleTouchPreview({ task, members, now, onClose, onOpenTask }) {
  return createPortal(
    <Modal title="작업 미리보기" closeLabel="미리보기 닫기" className="timeline-touch-preview"
      restoreFocusWithoutScroll onClose={onClose}>
      <div className="timeline-touch-preview-content">
        <TaskPreviewContent task={task} members={members} now={now} />
      </div>
      <div className="timeline-touch-preview-actions">
        <button type="button" className="primary-button" onClick={() => onOpenTask(task.id)}>
          작업 상세 보기
        </button>
      </div>
    </Modal>, document.body,
  );
}

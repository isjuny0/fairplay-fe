import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import CalendarPopover from './CalendarPopover.jsx';

export default function TaskWorkloadHelp() {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const closeButton = useRef(null);
  const id = useId();
  const closeAndFocus = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open]);

  return (
    <div
      className="task-workload-help"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="task-workload-help-trigger"
        aria-label="예상 작업량과 담당 비율 도움말"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={17} aria-hidden="true" />
      </button>
      {open && (
        <CalendarPopover
          id={id}
          anchorRef={trigger}
          width={320}
          fitContent
          onClose={() => setOpen(false)}
          className="task-workload-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
        >
          <div className="task-workload-popover-heading">
            <h4 id={`${id}-title`}>
              예상 작업량과 담당 비율은 어떻게 사용되나요?
            </h4>
            <button
              ref={closeButton}
              type="button"
              aria-label="도움말 닫기"
              onClick={closeAndFocus}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p>
            예상 작업량과 담당 비율은 기여도 계산에 반영됩니다. 실제로 오래
            걸렸다는 이유로 자동 증가하지 않으며, 작업 범위가 바뀌면 팀과 합의해
            조정해주세요.
          </p>
        </CalendarPopover>
      )}
    </div>
  );
}

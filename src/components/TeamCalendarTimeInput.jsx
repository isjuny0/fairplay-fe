import { useEffect, useRef, useState } from 'react';
import TimeInput from './TimeInput.jsx';

export default function TeamCalendarTimeInput({
  labelText,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  return (
    <div
      ref={root}
      className="team-calendar-time-input"
      role="group"
      aria-label={`${labelText} 입력 영역`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <TimeInput
        {...props}
        label={labelText.replace(/ 시간$/, '')}
        describedBy={describedBy}
        invalid={invalid}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        triggerRef={trigger}
      />
    </div>
  );
}
TeamCalendarTimeInput.compositeField = true;

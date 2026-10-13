import { useEffect, useId, useRef, useState } from 'react';
import { currentDateTime } from '../lib/dateTime.js';
import Icon from './Icon.jsx';

const pad = (value) => String(value).padStart(2, '0');
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export default function TimeInput({
  name,
  value,
  onChange,
  label,
  required,
  disabled,
  describedBy,
  invalid,
  onInvalid,
  open,
  onOpen,
  onClose,
  triggerRef,
}) {
  const id = useId();
  const input = useRef(null);
  const hours = useRef(null);
  const minutes = useRef(null);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    input.current?.setCustomValidity(
      value && !validTime(value)
        ? '시간을 00:00~23:59 형식으로 입력해 주세요.'
        : '',
    );
  }, [value]);
  useEffect(() => {
    if (!open) return;
    // Bring the selected values into view without scrolling the surrounding form.
    const centerSelection = () => {
      for (const list of [hours.current, minutes.current]) {
        const selected = list?.querySelector('[aria-pressed="true"]');
        if (selected)
          list.scrollTop +=
            selected.getBoundingClientRect().top -
            list.getBoundingClientRect().top -
            (list.clientHeight - selected.clientHeight) / 2;
      }
    };
    centerSelection();
    const observer = new ResizeObserver(centerSelection);
    observer.observe(hours.current);
    observer.observe(minutes.current);
    return () => observer.disconnect();
  }, [open, hour, minute]);
  const show = () => {
    if (open) {
      onClose();
      return;
    }
    const initial = validTime(value) ? value : currentDateTime().slice(11);
    setHour(Number(initial.slice(0, 2)));
    setMinute(Number(initial.slice(3, 5)));
    onOpen();
  };
  const selectWithKeyboard = (event, amount, maximum, update, list) => {
    const delta = {
      ArrowUp: -1,
      ArrowDown: 1,
      Home: -amount,
      End: maximum - amount,
    }[event.key];
    if (delta == null) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(maximum, amount + delta));
    update(next);
    requestAnimationFrame(() =>
      list.current?.querySelector(`[data-time-value="${next}"]`)?.focus(),
    );
  };
  return (
    <>
      <div className="time-control">
        <input
          ref={input}
          name={name ? `${name}-time` : undefined}
          data-validation-name={name}
          type="text"
          inputMode="numeric"
          placeholder="HH:mm"
          maxLength={5}
          required={required}
          disabled={disabled}
          value={value}
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          aria-label={`${label} 시간`}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onInvalid={onInvalid}
          onChange={onChange}
        />
        <button
          ref={triggerRef}
          type="button"
          className="calendar-trigger"
          disabled={disabled}
          aria-label={`${label} 시간 선택 열기`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={show}
        >
          <Icon name="clock" />
        </button>
      </div>
      {open && (
        <div
          className="time-picker-panel"
          id={`${id}-panel`}
          role="region"
          aria-label="시간 선택"
        >
          <div className="time-picker-heading">
            <strong>시간 선택</strong>
            <span>한국 시간 · 24시간</span>
          </div>
          <div className="time-picker-columns">
            <div className="time-picker-column">
              <span>시</span>
              <div
                ref={hours}
                className="time-picker-options"
                role="group"
                aria-label="시 선택"
              >
                {Array.from({ length: 24 }, (_, item) => (
                  <button
                    type="button"
                    key={item}
                    data-time-value={item}
                    aria-label={`${pad(item)}시`}
                    aria-pressed={hour === item}
                    tabIndex={hour === item ? 0 : -1}
                    onKeyDown={(event) =>
                      selectWithKeyboard(event, hour, 23, setHour, hours)
                    }
                    onClick={() => setHour(item)}
                  >
                    {pad(item)}
                  </button>
                ))}
              </div>
            </div>
            <span className="time-picker-colon" aria-hidden="true">
              :
            </span>
            <div className="time-picker-column">
              <span>분</span>
              <div
                ref={minutes}
                className="time-picker-options"
                role="group"
                aria-label="분 선택"
              >
                {Array.from({ length: 60 }, (_, item) => (
                  <button
                    type="button"
                    key={item}
                    data-time-value={item}
                    aria-label={`${pad(item)}분`}
                    aria-pressed={minute === item}
                    tabIndex={minute === item ? 0 : -1}
                    onKeyDown={(event) =>
                      selectWithKeyboard(event, minute, 59, setMinute, minutes)
                    }
                    onClick={() => setMinute(item)}
                  >
                    {pad(item)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="time-picker-footer">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const now = currentDateTime().slice(11);
                setHour(Number(now.slice(0, 2)));
                setMinute(Number(now.slice(3, 5)));
              }}
            >
              현재 시간
            </button>
            <strong aria-live="polite" aria-label="선택한 시간">
              {pad(hour)}:{pad(minute)}
            </strong>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onChange({ target: { value: `${pad(hour)}:${pad(minute)}` } });
                onClose();
                triggerRef.current?.focus();
              }}
            >
              시간 적용
            </button>
          </div>
        </div>
      )}
    </>
  );
}

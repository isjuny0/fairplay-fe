import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  calendarDays,
  currentDateTime,
  dateKey,
  isValidDate,
  shiftDate,
} from '../lib/dateTime.js';
import Icon from './Icon.jsx';
import TimeInput from './TimeInput.jsx';

// Keep the API's YYYY-MM-DDTHH:mm value while exposing separate date/time controls.
export default function DateTimeInput({
  name,
  value = '',
  onChange,
  required,
  disabled,
  onInvalid,
  labelText,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}) {
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const timeTrigger = useRef(null);
  const dateInput = useRef(null);
  const [open, setOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [popupLayout, setPopupLayout] = useState({});
  const [view, setView] = useState('days');
  const dateValue = value.split('T')[0] || '';
  const timeValue = value.split('T')[1]?.slice(0, 5) || '';
  const [draft, setDraft] = useState(dateValue);
  const initialDate = dateValue || currentDateTime().split('T')[0];
  const [year, setYear] = useState(Number(initialDate.slice(0, 4)));
  const [month, setMonth] = useState(Number(initialDate.slice(5, 7)) - 1);
  const [yearStart, setYearStart] = useState(Math.max(1, year - (year % 12)));
  useLayoutEffect(() => {
    if (!open && !timeOpen) return;
    const positionPanels = () => {
      const host = root.current;
      if (!host) return;
      const box = host.getBoundingClientRect();
      const dateBox = host
        .querySelector('.date-control')
        .getBoundingClientRect();
      const timeBox = host
        .querySelector('.time-control')
        .getBoundingClientRect();
      const boundary =
        host.closest('.modal-body')?.getBoundingClientRect().bottom ??
        window.innerHeight;
      const active = timeOpen ? timeBox : dateBox;
      const next = {
        '--date-popup-top': `${dateBox.bottom - box.top + 6}px`,
        '--time-popup-top': `${timeBox.bottom - box.top + 6}px`,
        '--time-popup-left': `${timeBox.left - box.left}px`,
        '--time-popup-width': `${Math.min(360, timeBox.width)}px`,
        '--picker-max-height': `${Math.max(160, Math.min(420, window.innerHeight - active.bottom - 18, boundary - active.bottom - 18))}px`,
      };
      setPopupLayout((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };
    positionPanels();
    const observer = new ResizeObserver(positionPanels);
    observer.observe(root.current);
    window.addEventListener('resize', positionPanels);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionPanels);
    };
  }, [open, timeOpen]);
  useEffect(() => {
    setDraft(dateValue);
  }, [dateValue]);
  useEffect(() => {
    dateInput.current?.setCustomValidity(
      draft && !isValidDate(draft) ? '올바른 날짜를 입력해 주세요.' : '',
    );
  }, [draft]);
  useEffect(() => {
    if (!open && !timeOpen) return;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
        setTimeOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, timeOpen]);
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setTimeOpen(false);
    }
  }, [disabled]);
  const change = (date, time) =>
    onChange?.({
      target: { name, value: date || time ? `${date}T${time}` : '' },
    });
  const showCalendar = () => {
    setTimeOpen(false);
    const selected = isValidDate(draft)
      ? draft
      : currentDateTime().split('T')[0];
    setYear(Number(selected.slice(0, 4)));
    setMonth(Number(selected.slice(5, 7)) - 1);
    setYearStart(
      Math.max(
        1,
        Number(selected.slice(0, 4)) - (Number(selected.slice(0, 4)) % 12),
      ),
    );
    setView('days');
    setOpen(!open);
  };
  const selectDate = (selected) => {
    setDraft(selected);
    change(selected, timeValue || currentDateTime().slice(11));
    setOpen(false);
    trigger.current?.focus();
  };
  const movePeriod = (direction) => {
    if (view === 'years')
      setYearStart(Math.min(9988, Math.max(1, yearStart + direction * 12)));
    else if (view === 'months')
      setYear(Math.min(9999, Math.max(1, year + direction)));
    else {
      const next = year * 12 + month + direction;
      if (next >= 12 && next < 120000) {
        setYear(Math.floor(next / 12));
        setMonth(next % 12);
      }
    }
  };
  const keyboardDate = (event, selected) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (offsets[event.key] == null) return;
    event.preventDefault();
    const next = shiftDate(selected, offsets[event.key]);
    if (!isValidDate(next)) return;
    setYear(Number(next.slice(0, 4)));
    setMonth(Number(next.slice(5, 7)) - 1);
    requestAnimationFrame(() =>
      root.current?.querySelector(`[data-date="${next}"]`)?.focus(),
    );
  };
  return (
    <div
      ref={root}
      className="date-time-input"
      style={popupLayout}
      role="group"
      aria-labelledby={labelledBy}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (open || timeOpen)) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setTimeOpen(false);
          (timeOpen ? timeTrigger : trigger).current?.focus();
        }
      }}
    >
      <span id={`${id}-date-label`} className="date-time-caption">
        날짜
      </span>
      <span id={`${id}-time-label`} className="date-time-caption">
        시간
      </span>
      <div className="date-control">
        <input
          ref={dateInput}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          required={required}
          disabled={disabled}
          value={draft}
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          aria-label={`${labelText} 날짜`}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onInvalid={onInvalid}
          onChange={(event) => {
            setDraft(event.target.value);
            change(
              event.target.value,
              timeValue || currentDateTime().slice(11),
            );
          }}
        />
        <button
          ref={trigger}
          type="button"
          className="calendar-trigger"
          disabled={disabled}
          aria-label={`${labelText} 달력 열기`}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={showCalendar}
        >
          <Icon name="calendar" />
          <span id={`${id}-calendar-label`} className="sr-only">
            달력 열기
          </span>
        </button>
      </div>
      <TimeInput
        name={name}
        required={required}
        disabled={disabled}
        value={timeValue}
        label={labelText}
        describedBy={describedBy}
        invalid={invalid}
        onInvalid={onInvalid}
        onChange={(event) => change(draft, event.target.value)}
        open={timeOpen}
        onOpen={() => {
          setOpen(false);
          setTimeOpen(true);
        }}
        onClose={() => setTimeOpen(false)}
        triggerRef={timeTrigger}
      />
      {open && (
        <div
          className="calendar-panel"
          id={`${id}-calendar`}
          role="region"
          aria-label="날짜 선택 달력"
        >
          <div className="calendar-heading">
            <button
              type="button"
              aria-label="이전 기간"
              onClick={() => movePeriod(-1)}
            >
              ‹
            </button>
            <div className="calendar-period">
              <button
                type="button"
                aria-label="연도 선택"
                onClick={() => {
                  setYearStart(Math.max(1, year - (year % 12)));
                  setView('years');
                }}
              >
                {view === 'years'
                  ? `${yearStart}–${Math.min(yearStart + 11, 9999)}년`
                  : `${year}년`}
              </button>
              {view !== 'years' && (
                <button
                  type="button"
                  aria-label="월 선택"
                  onClick={() => setView('months')}
                >
                  {month + 1}월
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="다음 기간"
              onClick={() => movePeriod(1)}
            >
              ›
            </button>
          </div>
          {view === 'years' ? (
            <div className="calendar-choice-grid" aria-label="연도 목록">
              {Array.from(
                { length: Math.min(12, 10000 - yearStart) },
                (_, index) => yearStart + index,
              ).map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-label={`${item}년 선택`}
                  aria-pressed={item === year}
                  onClick={() => {
                    setYear(item);
                    setView('months');
                  }}
                >
                  {item}년
                </button>
              ))}
            </div>
          ) : view === 'months' ? (
            <div className="calendar-choice-grid" aria-label="월 목록">
              {Array.from({ length: 12 }, (_, index) => index).map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-label={`${item + 1}월 선택`}
                  aria-pressed={item === month}
                  onClick={() => {
                    setMonth(item);
                    setView('days');
                  }}
                >
                  {item + 1}월
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="calendar-weekdays" aria-hidden="true">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div
                className="calendar-days"
                aria-label={`${year}년 ${month + 1}월 날짜 목록`}
              >
                {calendarDays(year, month).map((day, index) => {
                  const key = day && dateKey(year, month, day);
                  return day ? (
                    <button
                      type="button"
                      key={key}
                      data-date={key}
                      aria-label={`${year}년 ${month + 1}월 ${day}일`}
                      aria-pressed={key === dateValue}
                      aria-current={
                        key === currentDateTime().split('T')[0]
                          ? 'date'
                          : undefined
                      }
                      onKeyDown={(event) => keyboardDate(event, key)}
                      onClick={() => selectDate(key)}
                    >
                      {day}
                    </button>
                  ) : (
                    <span key={`empty-${index}`} />
                  );
                })}
              </div>
            </>
          )}
          <div className="calendar-footer">
            <button
              type="button"
              onClick={() => selectDate(currentDateTime().split('T')[0])}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              달력 닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
DateTimeInput.compositeField = true;

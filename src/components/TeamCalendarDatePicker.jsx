import { useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronRight, X } from 'lucide-react';
import {
  calendarDays,
  dateKey,
  isValidDate,
  shiftDate,
} from '../lib/dateTime.js';
import {
  calendarWeekdays,
  dateWeekday,
  normalizeSchedule,
  repeatFrequencies,
  scheduleAnchor,
  scheduleDescription,
  scheduleModes,
  singleSchedule,
  validateSchedule,
} from '../lib/calendarSchedule.js';
import CalendarPeriodNavigation from './CalendarPeriodNavigation.jsx';
import CalendarPopover from './CalendarPopover.jsx';

export default function TeamCalendarDatePicker({
  value,
  today,
  onConfirm,
  onClose,
  id,
  anchorRef,
}) {
  const initial = typeof value === 'string' ? singleSchedule(value) : value;
  const [draft, setDraft] = useState(initial);
  const [month, setMonth] = useState(scheduleAnchor(initial).slice(0, 7));
  const [activeField, setActiveField] = useState(null);
  const [error, setError] = useState('');
  const [rangeStep, setRangeStep] = useState('start');
  const [year, monthNumber] = month.split('-').map(Number);
  const grid = useRef(null);
  const tabsId = useId();
  const days = calendarDays(year, monthNumber - 1);
  while (days.length % 7) days.push(null);
  const anchor = scheduleAnchor(draft) || today;
  const changeMode = (mode) => {
    if (draft.mode === mode) return;
    const startDate = anchor;
    setError('');
    setActiveField(null);
    setRangeStep('start');
    setMonth(startDate.slice(0, 7));
    setDraft(
      mode === 'single'
        ? singleSchedule(startDate)
        : mode === 'multiple'
          ? { mode, dates: [startDate] }
          : mode === 'range'
            ? { mode, startDate, endDate: '' }
            : {
                mode,
                startDate,
                endDate: '',
                frequency: 'weekly',
                weekdays: [dateWeekday(startDate)],
              },
    );
  };
  const chooseDate = (date) => {
    setError('');
    if (draft.mode === 'single') setDraft(singleSchedule(date));
    else if (draft.mode === 'multiple')
      setDraft({
        ...draft,
        dates: draft.dates.includes(date)
          ? draft.dates.filter((item) => item !== date)
          : [...draft.dates, date].sort(),
      });
    else if (draft.mode === 'range') {
      if (rangeStep === 'start') {
        setDraft({ mode: 'range', startDate: date, endDate: '' });
        setRangeStep('end');
      } else {
        setDraft({
          ...draft,
          startDate: date < draft.startDate ? date : draft.startDate,
          endDate: date < draft.startDate ? draft.startDate : date,
        });
        setRangeStep('start');
      }
    } else {
      setDraft({
        ...draft,
        [activeField === 'end' ? 'endDate' : 'startDate']: date,
      });
      setActiveField(null);
    }
  };
  const isSelected = (date) =>
    draft.mode === 'multiple'
      ? draft.dates.includes(date)
      : draft.mode === 'range'
        ? date === draft.startDate || date === draft.endDate
        : date === (activeField === 'end' ? draft.endDate : draft.startDate);
  const apply = () => {
    const message = validateSchedule(draft);
    if (message) {
      setError(message);
      return;
    }
    onConfirm(normalizeSchedule(draft));
  };
  const dateField = (field) => {
    setActiveField(activeField === field ? null : field);
    setMonth(
      (field === 'end'
        ? draft.endDate || draft.startDate
        : draft.startDate
      ).slice(0, 7),
    );
  };
  return (
    <CalendarPopover
      anchorRef={anchorRef}
      fitContent
      onClose={onClose}
      id={id}
      className="team-calendar-date-picker team-calendar-inline-picker"
      role="region"
      aria-label="날짜 선택"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="team-calendar-picker-toolbar">
        <span>
          <CalendarDays size={19} />
          <span>
            {scheduleDescription(draft)}
            <small>{scheduleModes[draft.mode]} 일정</small>
          </span>
        </span>
        <div className="team-calendar-picker-actions">
          <button type="button" aria-label="날짜 선택 닫기" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>
      <div
        className="calendar-mode-tabs"
        role="tablist"
        aria-label="날짜 선택 방식"
      >
        {Object.entries(scheduleModes).map(([mode, label]) => (
          <button
            type="button"
            role="tab"
            id={`${tabsId}-${mode}`}
            aria-controls={`${tabsId}-panel`}
            aria-selected={draft.mode === mode}
            tabIndex={draft.mode === mode ? 0 : -1}
            key={mode}
            onClick={() => changeMode(mode)}
            onKeyDown={(event) => {
              const modes = Object.keys(scheduleModes);
              const direction =
                event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'ArrowLeft'
                    ? -1
                    : 0;
              if (direction) {
                event.preventDefault();
                const next =
                  modes[
                    (modes.indexOf(mode) + direction + modes.length) %
                      modes.length
                  ];
                changeMode(next);
                requestAnimationFrame(() =>
                  document.getElementById(`${tabsId}-${next}`)?.focus(),
                );
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="team-calendar-picker-body"
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${draft.mode}`}
      >
        {draft.mode === 'repeat' && !activeField ? (
          <div className="calendar-repeat-options">
            <label className="calendar-repeat-frequency">
              <span>반복 유형</span>
              <select
                aria-label="반복 유형"
                value={draft.frequency}
                onChange={(event) => {
                  setError('');
                  setDraft({
                    ...draft,
                    frequency: event.target.value,
                    weekdays: draft.weekdays || [dateWeekday(draft.startDate)],
                  });
                }}
              >
                {Object.entries(repeatFrequencies).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.frequency === 'weekly' ? (
              <div
                className="calendar-repeat-weekdays"
                role="group"
                aria-label="반복 요일"
              >
                {calendarWeekdays.map((label, day) => (
                  <button
                    type="button"
                    aria-label={`${label}요일`}
                    aria-pressed={draft.weekdays.includes(day)}
                    key={day}
                    onClick={() => {
                      setError('');
                      setDraft({
                        ...draft,
                        weekdays: draft.weekdays.includes(day)
                          ? draft.weekdays.filter((item) => item !== day)
                          : [...draft.weekdays, day].sort(),
                      });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="calendar-repeat-hint">
                {draft.frequency === 'monthly'
                  ? `매월 ${Number(draft.startDate.slice(8))}일`
                  : `매년 ${Number(draft.startDate.slice(5, 7))}월 ${Number(draft.startDate.slice(8))}일`}
                에 반복해요. 해당 날짜가 없는 달·연도는 건너뜁니다.
              </p>
            )}
            <button
              type="button"
              className="calendar-repeat-date"
              aria-label="반복 시작 날짜"
              aria-expanded={activeField === 'start'}
              onClick={() => dateField('start')}
            >
              <CalendarDays size={16} />
              <span>시작 날짜</span>
              <strong>{draft.startDate.replaceAll('-', '.')}</strong>
              <ChevronRight size={15} />
            </button>
            <label className="calendar-repeat-unlimited">
              <input
                type="checkbox"
                checked={!draft.endDate}
                onChange={(event) => {
                  setError('');
                  setDraft({
                    ...draft,
                    endDate: event.target.checked ? '' : draft.startDate,
                  });
                  setActiveField(null);
                }}
              />
              종료일 없음
            </label>
            {draft.endDate && (
              <button
                type="button"
                className="calendar-repeat-date"
                aria-label="반복 종료 날짜"
                aria-expanded={activeField === 'end'}
                onClick={() => dateField('end')}
              >
                <CalendarDays size={16} />
                <span>종료 날짜</span>
                <strong>{draft.endDate.replaceAll('-', '.')}</strong>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        ) : draft.mode !== 'repeat' ? (
          <p className="calendar-mode-hint">
            {draft.mode === 'single'
              ? '하루를 선택하세요.'
              : draft.mode === 'range'
                ? draft.endDate
                  ? '시작일부터 종료일까지 이어서 표시돼요.'
                  : rangeStep === 'start'
                    ? '시작 날짜를 선택하세요.'
                    : '종료 날짜를 선택하세요.'
                : '원하는 날짜를 여러 개 선택하세요. 다시 누르면 해제돼요.'}
          </p>
        ) : (
          <button
            type="button"
            className="calendar-repeat-back"
            onClick={() => setActiveField(null)}
          >
            <ChevronRight size={14} />
            {activeField === 'end' ? '종료 날짜 선택' : '시작 날짜 선택'}
          </button>
        )}
        {(draft.mode !== 'repeat' || activeField) && (
          <div className="calendar-picker-month-panel">
            <CalendarPeriodNavigation
              month={month}
              onMonthChange={setMonth}
              today={today}
              onToday={() => {
                if (draft.mode === 'single') setDraft(singleSchedule(today));
              }}
            >
              <div className="calendar-picker-square-face">
                <div
                  className="team-calendar-picker-weekdays"
                  aria-hidden="true"
                >
                  {calendarWeekdays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div
                  className="team-calendar-picker-grid"
                  style={{ '--picker-week-count': days.length / 7 }}
                  role="group"
                  aria-label={`${year}년 ${monthNumber}월 날짜 선택`}
                  data-month={month}
                  ref={grid}
                >
                  {days.map((day, index) => {
                    if (!day) return <span key={`blank-${index}`} />;
                    const date = dateKey(year, monthNumber - 1, day);
                    const inRange =
                      draft.mode === 'range' &&
                      draft.endDate &&
                      date >= draft.startDate &&
                      date <= draft.endDate;
                    return (
                      <button
                        type="button"
                        data-date={date}
                        key={date}
                        aria-label={`${year}년 ${monthNumber}월 ${day}일`}
                        aria-pressed={isSelected(date)}
                        aria-current={date === today ? 'date' : undefined}
                        className={`${inRange ? 'is-in-range' : ''} ${inRange && date === draft.startDate ? 'is-range-start' : ''} ${inRange && date === draft.endDate ? 'is-range-end' : ''} ${index % 7 === 0 ? 'is-sunday' : index % 7 === 6 ? 'is-saturday' : ''}`}
                        onClick={() => chooseDate(date)}
                        onKeyDown={(event) => {
                          const amount = {
                            ArrowLeft: -1,
                            ArrowRight: 1,
                            ArrowUp: -7,
                            ArrowDown: 7,
                          }[event.key];
                          if (!amount) return;
                          event.preventDefault();
                          const next = shiftDate(date, amount);
                          if (!isValidDate(next)) return;
                          if (draft.mode === 'single')
                            setDraft(singleSchedule(next));
                          setMonth(next.slice(0, 7));
                          requestAnimationFrame(() =>
                            grid.current
                              ?.querySelector(`[data-date="${next}"]`)
                              ?.focus(),
                          );
                        }}
                      >
                        <span>{day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CalendarPeriodNavigation>
          </div>
        )}
        {draft.mode === 'multiple' && (
          <div className="calendar-multiple-dates">
            {draft.dates.slice(0, 3).map((date) => (
              <button
                type="button"
                key={date}
                aria-label={`${date} 선택 해제`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    dates: draft.dates.filter((item) => item !== date),
                  })
                }
              >
                {date.slice(5).replace('-', '.')} ×
              </button>
            ))}
            {draft.dates.length > 3 && (
              <span className="calendar-multiple-more">
                +{draft.dates.length - 3}일
              </span>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="dashboard-form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="team-calendar-picker-footer">
        <button type="button" aria-label="선택한 날짜 적용" onClick={apply}>
          <Check size={14} /> 적용
        </button>
      </footer>
    </CalendarPopover>
  );
}

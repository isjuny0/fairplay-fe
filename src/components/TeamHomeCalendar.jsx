import { useEffect, useId, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { isValidDate, shiftDate } from '../lib/dateTime.js';
import {
  calendarMonthDays,
  calendarRelativeDay,
  eventKinds,
  validateCalendarEvent,
} from '../lib/teamDashboard.js';
import { useInteractions } from '../hooks/useInteractions.js';
import { Field, Modal } from './ui.jsx';
import TeamCalendarDatePicker from './TeamCalendarDatePicker.jsx';
import CalendarPeriodNavigation from './CalendarPeriodNavigation.jsx';
import TeamCalendarTimeInput from './TeamCalendarTimeInput.jsx';
import CalendarPopover from './CalendarPopover.jsx';
import {
  calendarEventLanes,
  dateWeekday,
  eventOccursOn,
  eventSchedule,
  scheduleAnchor,
  scheduleDescription,
} from '../lib/calendarSchedule.js';
import '../team-calendar.css';

const dateTitle = (date) => {
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(`${date}T12:00:00+09:00`));
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 (${weekday})`;
};
const sortEvents = (events) =>
  [...events].sort(
    (a, b) =>
      (a.start || '').localeCompare(b.start || '') ||
      a.title.localeCompare(b.title, 'ko'),
  );
const weekStart = (date) => shiftDate(date, -dateWeekday(date));

export default function TeamHomeCalendar({ events, onChange, today }) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [calendarView, setCalendarView] = useState('month');
  const [fortnightStart, setFortnightStart] = useState(() => weekStart(today));
  const [dayOpen, setDayOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const grid = useRef(null);
  const titleInput = useRef(null);
  const categoryTrigger = useRef(null);
  const categoryName = useId();
  const dateTrigger = useRef(null);
  const datePanelId = useId();
  const categoryPanelId = useId();
  const { confirm } = useInteractions();
  const fortnight = calendarView === 'fortnight';
  const days = fortnight
    ? Array.from({ length: 14 }, (_, index) => {
        const date = shiftDate(fortnightStart, index);
        return isValidDate(date) ? date : null;
      })
    : calendarMonthDays(year, monthNumber - 1);
  const daily = sortEvents(
    events.filter((event) => eventOccursOn(event, selected)),
  );
  const lanes = fortnight ? calendarEventLanes(events, days, 5) : null;
  const moveFortnight = (direction) => {
    const next = shiftDate(fortnightStart, direction * 14);
    if (!isValidDate(next) || !isValidDate(shiftDate(next, 13))) return;
    setFortnightStart(next);
    setMonth(next.slice(0, 7));
    setSelected(next);
  };
  const editorOpen = Boolean(editor);
  useEffect(() => {
    if (!editorOpen) return;
    const frame = requestAnimationFrame(() => titleInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editorOpen]);
  const openEditor = (record) => {
    setError('');
    setNotice(null);
    setCategoriesOpen(false);
    setDatePickerOpen(false);
    setEditor(record);
  };
  const newEvent = () =>
    openEditor({
      title: '',
      date: selected,
      start: '',
      end: '',
      kind: 'meeting',
      notes: '',
    });
  const selectDay = (date) => {
    setNotice(null);
    setSelected(date);
    setMonth(date.slice(0, 7));
    setDayOpen(true);
  };
  const save = (event) => {
    event.preventDefault();
    const message = validateCalendarEvent(editor);
    if (message) {
      setError(message);
      return;
    }
    const record = {
      ...editor,
      id: editor.id || crypto.randomUUID(),
      title: editor.title.trim(),
      notes: editor.notes.trim(),
    };
    const persisted = onChange([
      ...events.filter((item) => item.id !== record.id),
      record,
    ]);
    const destination = eventOccursOn(record, selected)
      ? selected
      : record.date;
    setSelected(destination);
    setMonth(destination.slice(0, 7));
    if (fortnight && !days.includes(destination))
      setFortnightStart(weekStart(destination));
    setEditor(null);
    setDayOpen(true);
    setNotice({
      success: persisted,
      message: persisted
        ? '일정을 저장했습니다.'
        : '일정을 변경했지만 브라우저에 저장하지 못했습니다.',
    });
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: '일정 삭제',
        message: `‘${editor.title}’ ${eventSchedule(editor).mode === 'single' ? '일정을' : '일정 전체를'} 삭제할까요?`,
        label: '삭제',
      }))
    )
      return;
    const persisted = onChange(
      events.filter((event) => event.id !== editor.id),
    );
    setEditor(null);
    setNotice({
      success: persisted,
      message: persisted
        ? '일정을 삭제했습니다.'
        : '일정을 삭제했지만 브라우저 저장소에 반영하지 못했습니다.',
    });
  };
  const focusDay = (date) => {
    setSelected(date);
    setMonth(date.slice(0, 7));
    if (fortnight && !days.includes(date))
      setFortnightStart(
        shiftDate(fortnightStart, date < fortnightStart ? -14 : 14),
      );
    requestAnimationFrame(() =>
      grid.current?.querySelector(`[data-date="${date}"]`)?.focus(),
    );
  };
  return (
    <section
      className={`dashboard-calendar dashboard-card team-calendar calendar-view-${calendarView}`}
      aria-label="직접 등록 일정 캘린더"
    >
      <header className="dashboard-card-heading">
        <div className="dashboard-title">
          <span className="dashboard-icon">
            <CalendarDays size={18} />
          </span>
          <h2>캘린더</h2>
          <span className="dashboard-tag">직접 등록</span>
        </div>
        <div
          className="team-calendar-view-switch"
          role="group"
          aria-label="캘린더 보기"
        >
          {[
            ['month', '월간'],
            ['fortnight', '2주'],
          ].map(([view, label]) => (
            <button
              type="button"
              key={view}
              aria-pressed={calendarView === view}
              onClick={() => {
                if (view === 'fortnight')
                  setFortnightStart(weekStart(selected));
                setCalendarView(view);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <CalendarPeriodNavigation
        month={month}
        onMonthChange={(next) => {
          setMonth(next);
          setSelected(next + '-01');
          if (fortnight) setFortnightStart(weekStart(next + '-01'));
        }}
        today={today}
        showToday={false}
        caption={
          fortnight
            ? `${fortnightStart.slice(5).replace('-', '.')} – ${shiftDate(fortnightStart, 13).slice(5).replace('-', '.')}`
            : undefined
        }
        dayNavigation={
          fortnight
            ? {
                label: '2주',
                onStep: moveFortnight,
                previousDisabled: !isValidDate(shiftDate(fortnightStart, -14)),
                nextDisabled: !isValidDate(shiftDate(fortnightStart, 27)),
              }
            : undefined
        }
      >
        <div className="team-calendar-date-area">
          <div className="team-calendar-square-face">
            <div className="team-calendar-weekdays" aria-hidden="true">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div
              className="team-calendar-grid"
              style={{ '--calendar-week-count': days.length / 7 }}
              ref={grid}
              role="group"
              aria-label={
                fortnight
                  ? `${fortnightStart}부터 ${shiftDate(fortnightStart, 13)}까지 2주 날짜`
                  : `${year}년 ${monthNumber}월 날짜`
              }
            >
              {days.map((date, index) => {
                if (!date)
                  return (
                    <span
                      className="team-calendar-blank"
                      key={`blank-${index}`}
                    />
                  );
                const entries = sortEvents(
                  events.filter((event) => eventOccursOn(event, date)),
                );
                const [cellYear, cellMonth, day] = date.split('-').map(Number);
                return (
                  <button
                    key={date}
                    data-date={date}
                    aria-label={`${cellYear}년 ${cellMonth}월 ${day}일, 일정 ${entries.length}개`}
                    aria-pressed={selected === date}
                    aria-current={date === today ? 'date' : undefined}
                    className={`team-calendar-day ${fortnight || date.startsWith(month) ? '' : 'is-adjacent'} ${index % 7 === 0 ? 'is-sunday' : index % 7 === 6 ? 'is-saturday' : ''}`}
                    onClick={() => selectDay(date)}
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      }[event.key];
                      if (delta) {
                        event.preventDefault();
                        const next = shiftDate(date, delta);
                        if (isValidDate(next)) focusDay(next);
                      }
                    }}
                  >
                    <span className="team-calendar-day-number">{day}</span>
                    <span
                      className={
                        fortnight
                          ? 'team-calendar-day-events'
                          : 'team-calendar-event-dots'
                      }
                      aria-hidden="true"
                    >
                      {fortnight
                        ? lanes.get(date).slots.map((slot, index) =>
                            slot ? (
                              <span
                                key={`${slot.event.id}-${index}`}
                                title={slot.event.title}
                                className={`team-calendar-label event-${slot.event.kind} ${slot.range ? 'is-range' : ''} ${slot.startsHere ? 'is-range-start' : ''} ${slot.endsHere ? 'is-range-end' : ''}`}
                              >
                                {slot.showTitle ? slot.event.title : '\u00a0'}
                              </span>
                            ) : (
                              <span
                                key={`empty-${index}`}
                                className="team-calendar-label-slot"
                              />
                            ),
                          )
                        : entries
                            .filter((event) => {
                              const schedule = eventSchedule(event);
                              return (
                                schedule.mode !== 'range' ||
                                date === schedule.startDate ||
                                date === schedule.endDate
                              );
                            })
                            .map((event) => (
                              <i
                                key={event.id}
                                title={event.title}
                                className={`team-calendar-event-dot event-${event.kind}`}
                              />
                            ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CalendarPeriodNavigation>
      <footer className="team-calendar-footer">
        <div className="team-calendar-legend">
          {Object.entries(eventKinds).map(([kind, label]) => (
            <span className={`event-${kind}`} key={kind}>
              <i />
              {label}
            </span>
          ))}
        </div>
        <span>날짜를 눌러 일정을 기록하세요</span>
      </footer>
      {dayOpen && (
        <div className="team-calendar-dialog team-calendar-day-dialog">
          <Modal title={dateTitle(selected)} onClose={() => setDayOpen(false)}>
            <div className="team-calendar-day-meta">
              <span className="team-calendar-relative">
                {calendarRelativeDay(selected, today)}
              </span>
              <span>일정 {daily.length}개</span>
            </div>
            {notice && (
              <p
                className={`team-calendar-notice ${notice.success ? '' : 'is-error'}`}
                role={notice.success ? 'status' : 'alert'}
              >
                {notice.message}
              </p>
            )}
            <div className="team-calendar-day-content">
              {daily.length ? (
                <ul className="team-calendar-agenda">
                  {daily.map((event) => (
                    <li key={event.id}>
                      <button
                        className={`team-calendar-agenda-event event-${event.kind}`}
                        aria-label={`${event.title} 일정 수정`}
                        onClick={() => openEditor(event)}
                      >
                        <span className="team-calendar-agenda-marker" />
                        <span className="team-calendar-agenda-copy">
                          <span className="team-calendar-agenda-category">
                            {eventKinds[event.kind]}
                            {eventSchedule(event).mode !== 'single' &&
                              ` · ${scheduleDescription(eventSchedule(event))}`}
                          </span>
                          <strong>{event.title}</strong>
                          <span className="team-calendar-agenda-time">
                            <Clock3 size={12} />
                            {event.start
                              ? `${event.start} – ${event.end}`
                              : '종일'}
                          </span>
                          {event.notes && <small>{event.notes}</small>}
                        </span>
                        <Pencil size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="team-calendar-empty-day">
                  <span>
                    <CalendarDays size={28} strokeWidth={1.3} />
                  </span>
                  <strong>아직 등록된 일정이 없어요</strong>
                  <p>회의부터 작은 약속까지, 함께할 일을 남겨 보세요.</p>
                </div>
              )}
            </div>
            <button className="team-calendar-add-day" onClick={newEvent}>
              <Plus size={18} />새 일정 추가
            </button>
          </Modal>
        </div>
      )}
      {editor && (
        <div
          className="team-calendar-dialog team-calendar-composer"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && (datePickerOpen || categoriesOpen)) {
              event.preventDefault();
              event.stopPropagation();
              if (datePickerOpen) {
                setDatePickerOpen(false);
                dateTrigger.current?.focus();
              } else {
                setCategoriesOpen(false);
                categoryTrigger.current?.focus();
              }
            }
          }}
        >
          <Modal
            title={editor.id ? '일정 수정' : '일정 추가'}
            onClose={() => setEditor(null)}
          >
            <form className="team-calendar-event-form" onSubmit={save}>
              <div className="team-calendar-title-field">
                <Field label="일정 이름">
                  <input
                    ref={titleInput}
                    required
                    maxLength={80}
                    value={editor.title}
                    placeholder="어떤 일정을 기록할까요?"
                    onChange={(event) => {
                      setError('');
                      setEditor({ ...editor, title: event.target.value });
                    }}
                  />
                </Field>
              </div>
              <div className="team-calendar-entry-options">
                <div className="team-calendar-date-control">
                  <span>날짜</span>
                  <button
                    type="button"
                    ref={dateTrigger}
                    aria-label="날짜 선택"
                    aria-controls={datePanelId}
                    aria-expanded={datePickerOpen}
                    onClick={() => {
                      setDatePickerOpen(!datePickerOpen);
                      setCategoriesOpen(false);
                    }}
                  >
                    <CalendarDays size={15} />
                    <span>
                      {eventSchedule(editor).mode === 'single'
                        ? dateTitle(editor.date)
                        : scheduleDescription(eventSchedule(editor))}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className="team-calendar-category-control">
                  <span>카테고리</span>
                  <button
                    ref={categoryTrigger}
                    type="button"
                    className={`team-calendar-category-trigger event-${editor.kind}`}
                    aria-label={`카테고리: ${eventKinds[editor.kind]}`}
                    aria-expanded={categoriesOpen}
                    aria-controls={categoryPanelId}
                    onClick={() => {
                      setCategoriesOpen(!categoriesOpen);
                      setDatePickerOpen(false);
                    }}
                  >
                    <i />
                    {eventKinds[editor.kind]}
                    <ChevronDown size={14} />
                  </button>
                  {categoriesOpen && (
                    <CalendarPopover
                      anchorRef={categoryTrigger}
                      onClose={() => setCategoriesOpen(false)}
                      id={categoryPanelId}
                      className="team-calendar-categories team-calendar-category-dropdown"
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                          setCategoriesOpen(false);
                          categoryTrigger.current?.focus();
                        }
                      }}
                    >
                      <div role="radiogroup" aria-label="일정 종류">
                        {Object.entries(eventKinds).map(([kind, label]) => (
                          <label
                            className={`team-calendar-category event-${kind}`}
                            key={kind}
                          >
                            <input
                              type="radio"
                              name={categoryName}
                              value={kind}
                              checked={editor.kind === kind}
                              onChange={() => {
                                setEditor({ ...editor, kind });
                                setCategoriesOpen(false);
                                categoryTrigger.current?.focus();
                              }}
                            />
                            <span>
                              <i />
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </CalendarPopover>
                  )}
                </div>
              </div>
              {datePickerOpen && (
                <TeamCalendarDatePicker
                  anchorRef={dateTrigger}
                  id={datePanelId}
                  value={eventSchedule(editor)}
                  today={today}
                  onClose={() => {
                    setDatePickerOpen(false);
                    dateTrigger.current?.focus();
                  }}
                  onConfirm={(schedule) => {
                    setEditor({
                      ...editor,
                      date: scheduleAnchor(schedule),
                      schedule,
                    });
                    setDatePickerOpen(false);
                    requestAnimationFrame(() => dateTrigger.current?.focus());
                  }}
                />
              )}
              {editor.id && eventSchedule(editor).mode !== 'single' && (
                <p className="calendar-series-notice">
                  수정·삭제하면 이 일정의 모든 날짜에 함께 적용돼요.
                </p>
              )}
              <details
                className="team-calendar-event-extras"
                open={
                  Boolean(editor.id && (editor.start || editor.notes)) ||
                  undefined
                }
              >
                <summary>
                  <Clock3 size={15} />
                  시간·메모 추가
                  <ChevronDown size={14} />
                </summary>
                <div className="team-calendar-extras-body">
                  <div className="team-calendar-time-row">
                    <Field label="시작 시간" help="비워 두면 종일 일정">
                      <TeamCalendarTimeInput
                        value={editor.start}
                        onChange={(event) =>
                          setEditor({ ...editor, start: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="종료 시간">
                      <TeamCalendarTimeInput
                        value={editor.end}
                        onChange={(event) =>
                          setEditor({ ...editor, end: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="메모">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      placeholder="장소나 함께 나눌 이야기를 적어 주세요."
                      value={editor.notes}
                      onChange={(event) =>
                        setEditor({ ...editor, notes: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </details>
              {error && (
                <p className="dashboard-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                {editor.id && (
                  <button
                    type="button"
                    className="dashboard-delete-event"
                    onClick={remove}
                  >
                    <Trash2 size={15} />
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditor(null)}
                >
                  취소
                </button>
                <button type="submit" className="primary-button">
                  일정 저장
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </section>
  );
}

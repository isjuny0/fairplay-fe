import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKey } from '../lib/dateTime.js';
import '../calendar-period.css';

const blockStart = (year) =>
  Math.min(9988, Math.floor((year - 1) / 12) * 12 + 1);

// Shared drill-up navigation: dates → months → years, without changing a date selection.
export default function CalendarPeriodNavigation({
  month,
  onMonthChange,
  today,
  onToday,
  showToday = true,
  caption,
  dayNavigation,
  children,
}) {
  const [view, setView] = useState('days');
  const [yearStart, setYearStart] = useState(() =>
    blockStart(Number(month.slice(0, 4))),
  );
  const [year, monthNumber] = month.split('-').map(Number);
  const showHigher = () => {
    if (view === 'days') setView('months');
    else if (view === 'months') {
      setYearStart(blockStart(year));
      setView('years');
    }
  };
  const step = (direction) => {
    if (view === 'years')
      setYearStart(Math.max(1, Math.min(9988, yearStart + direction * 12)));
    else if (view === 'months')
      onMonthChange(
        dateKey(
          Math.max(1, Math.min(9999, year + direction)),
          monthNumber - 1,
          1,
        ).slice(0, 7),
      );
    else if (dayNavigation) dayNavigation.onStep(direction);
    else {
      const next = Math.max(
        12,
        Math.min(119999, year * 12 + monthNumber - 1 + direction),
      );
      onMonthChange(dateKey(Math.floor(next / 12), next % 12, 1).slice(0, 7));
    }
  };
  const previousDisabled =
    view === 'days'
      ? dayNavigation
        ? dayNavigation.previousDisabled
        : month === '0001-01'
      : view === 'months'
        ? year === 1
        : yearStart === 1;
  const nextDisabled =
    view === 'days'
      ? dayNavigation
        ? dayNavigation.nextDisabled
        : month === '9999-12'
      : view === 'months'
        ? year === 9999
        : yearStart === 9988;
  const stepName =
    view === 'days'
      ? dayNavigation?.label || '달'
      : view === 'months'
        ? '연도'
        : '연도 범위';
  return (
    <div className={`calendar-period-navigation period-view-${view}`}>
      <div className="calendar-period-heading">
        <div className="calendar-period-caption">
          <h3
            aria-label={
              view === 'days' ? `${year}년 ${monthNumber}월` : undefined
            }
          >
            {view === 'years' ? (
              <span className="calendar-year-block">
                {yearStart}–{yearStart + 11}
              </span>
            ) : (
              <button
                type="button"
                className="calendar-period-up"
                aria-label={view === 'days' ? '월 목록 보기' : '연도 목록 보기'}
                onClick={showHigher}
                title={view === 'days' ? '월 선택' : '연도 선택'}
              >
                {view === 'days' ? (
                  <>
                    <span>{monthNumber}월</span>
                    <small>{year}</small>
                  </>
                ) : (
                  <span>{year}</span>
                )}
              </button>
            )}
          </h3>
          {view === 'days' && caption && (
            <span className="calendar-period-count">{caption}</span>
          )}
        </div>
        <div className="calendar-period-controls">
          {showToday && (
            <button
              type="button"
              className="team-calendar-today"
              onClick={() => {
                onMonthChange(today.slice(0, 7));
                onToday?.();
                setView('days');
              }}
            >
              오늘
            </button>
          )}
          <button
            type="button"
            className="dashboard-icon-button"
            aria-label={`이전 ${stepName}`}
            disabled={previousDisabled}
            onClick={() => step(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="dashboard-icon-button"
            aria-label={`다음 ${stepName}`}
            disabled={nextDisabled}
            onClick={() => step(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {view === 'days' ? (
        children
      ) : (
        <div className="calendar-period-options-area">
          <div
            className="calendar-period-options"
            role="group"
            aria-label={
              view === 'months'
                ? `${year}년 월 선택`
                : `${yearStart}년부터 ${yearStart + 11}년까지 연도 선택`
            }
          >
            {Array.from({ length: 12 }, (_, index) => {
              const value = view === 'months' ? index + 1 : yearStart + index;
              const active =
                view === 'months' ? value === monthNumber : value === year;
              const current =
                view === 'months'
                  ? year === Number(today.slice(0, 4)) &&
                    value === Number(today.slice(5, 7))
                  : value === Number(today.slice(0, 4));
              return (
                <button
                  type="button"
                  aria-label={
                    view === 'months' ? `${year}년 ${value}월` : `${value}년`
                  }
                  aria-pressed={active}
                  aria-current={current ? 'date' : undefined}
                  key={value}
                  onClick={() => {
                    if (view === 'years') {
                      onMonthChange(
                        dateKey(value, monthNumber - 1, 1).slice(0, 7),
                      );
                      setView('months');
                    } else {
                      onMonthChange(dateKey(year, value - 1, 1).slice(0, 7));
                      setView('days');
                    }
                  }}
                >
                  {value}
                  {view === 'months' ? '월' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

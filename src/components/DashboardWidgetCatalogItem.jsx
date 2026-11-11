import { useId, useRef } from 'react';
import { Eye, Minus, Plus } from 'lucide-react';
import CalendarPopover from './CalendarPopover.jsx';
import Icon from './Icon.jsx';
import './widget-catalog-preview.css';

// Read-only examples keep previews independent of live widget requests and actions.
function WidgetExample({ id }) {
  if (id === 'calendar') return <>
    <div className="widget-example-caption"><strong>11월</strong><span>월간 · 2주</span></div>
    <div className="widget-example-calendar">
      {['일', '월', '화', '수', '목', '금', '토'].map(day => <small key={day}>{day}</small>)}
      {Array.from({ length: 30 }, (_, index) => <span key={index} className={index === 11 ? 'is-today' : ''}>{index + 1}{[5, 15, 23].includes(index) && <i />}</span>)}
    </div>
  </>;
  if (id === 'progress') return <>
    <div className="widget-example-ring"><strong>62.5%</strong></div>
    <p>조금씩, 함께 앞으로</p><small>현재 작업의 예상 시간 기준</small>
  </>;
  if (id === 'contribution') return <>
    <small>공개된 최종 결과</small><strong className="widget-example-score">82.5점</strong>
    <p>개인별 100점 만점 종합 평가</p><div className="widget-example-composition"><i /><i /><i /></div>
  </>;
  if (id === 'attention') return <div className="widget-example-attention">
    <div><span>내 마감 지연</span><strong>1건</strong></div><div><span>7일 내 마감</span><strong>3건</strong></div>
  </div>;
  if (id === 'upcoming') return <div className="widget-example-tasks">
    {['설문 결과 분석', '서비스 흐름 정리', '발표 자료 준비'].map((title, index) => <div key={title}><i /><span><strong>{title}</strong><small>11월 {12 + index}일 마감</small></span><span>›</span></div>)}
  </div>;
  if (id === 'mywork') return <div className="widget-example-metrics">
    {['내 담당 비중', '내 완료 비중', '내 작업 완료율'].map((label, index) => <div key={label}><span>{label}</span><strong>{[40, 25, 62.5][index]}%</strong><div><i style={{ width: `${[40, 25, 62.5][index]}%` }} /></div></div>)}
  </div>;
  if (id === 'members') return <div className="widget-example-members">
    {['김하늘', '이지원', '박선우'].map((name, index) => <div key={name}><span>{name[0]}</span><strong>{name}</strong><small>{index === 0 ? '팀 리더' : '팀원'}</small></div>)}
  </div>;
  if (id === 'memo') return <div className="widget-example-memo">다음 회의에서 공유할 내용<br /><br />• 설문 결과 함께 검토하기<br />• 발표 자료 역할 나누기</div>;
  if (id === 'status') return <>
    <div className="widget-example-composition is-status"><i /><i /><i /><i /></div>
    <div className="widget-example-status">{['할 일', '진행 중', '수정 중', '완료'].map((label, index) => <span key={label}><i />{label}<strong>{[3, 2, 1, 4][index]}</strong></span>)}</div>
  </>;
  return <div className="widget-example-shortcut"><Icon name={id === 'evaluation' ? 'review' : 'file'} /><strong>{id === 'evaluation' ? '동료 평가 작성' : '공개 리포트 보기'}</strong><span>↗</span></div>;
}

export default function DashboardWidgetCatalogItem({ widget, added, disabled, onToggle, preview, onPreview }) {
  const anchor = useRef(null);
  const previewId = useId();
  const visible = preview === widget.id && !disabled;
  const hide = () => onPreview(current => current === widget.id ? null : current);
  return <div className="dashboard-catalog-item" ref={anchor}
    onMouseEnter={() => onPreview(widget.id)}
    onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) hide(); }}
    onFocusCapture={() => onPreview(widget.id)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}
    onKeyDownCapture={event => {
      if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); hide(); }
    }}
  >
    <button type="button" className={`dashboard-catalog-select ${added ? 'is-added' : ''}`}
      disabled={disabled} aria-pressed={added} aria-label={`${widget.title} ${added ? '제거' : '추가'}`}
      aria-describedby={visible ? previewId : undefined}
      onClick={() => { hide(); onToggle(); }}
    >
      <span className="dashboard-icon"><Icon name={widget.icon} /></span>
      <span><strong>{widget.title}</strong><small>{widget.description}</small></span>
      <span className="dashboard-catalog-action">{added ? <Minus size={16} /> : <Plus size={16} />}{added ? '제거' : '추가'}</span>
    </button>
    <button type="button" className="dashboard-catalog-preview-trigger" disabled={disabled}
      aria-label={`${widget.title} 위젯 미리보기`} aria-describedby={visible ? previewId : undefined}
      onClick={() => onPreview(widget.id)} title="미리보기"
    ><Eye size={17} aria-hidden="true" /></button>
    {visible && <CalendarPopover anchorRef={anchor} width={300} onClose={hide}
      id={previewId} role="tooltip" aria-label={`${widget.title} 위젯 미리보기`} className="widget-catalog-preview"
    >
      <div className="widget-example-caption"><strong>{widget.title}</strong><small>예시 화면</small></div>
      <div className={`widget-example widget-example-${widget.id}`}><WidgetExample id={widget.id} /></div>
    </CalendarPopover>}
  </div>;
}

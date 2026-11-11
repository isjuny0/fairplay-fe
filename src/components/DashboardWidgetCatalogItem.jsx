import { useId, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import DashboardWidgetPreview from './DashboardWidgetPreview.jsx';
import CalendarPopover from './CalendarPopover.jsx';
import Icon from './Icon.jsx';
import './widget-catalog-preview.css';

export default function DashboardWidgetCatalogItem({ widget, added, disabled, onToggle, preview, onPreview, mobile }) {
  const previewId = useId();
  const anchor = useRef(null);
  const visible = preview === widget.id;
  const hide = () => onPreview(current => current === widget.id ? null : current);
  return <div className={`dashboard-catalog-item ${added ? 'is-added' : ''} ${visible ? 'is-previewing' : ''}`}
    ref={anchor}
    onMouseEnter={() => { if (!disabled && !mobile) onPreview(widget.id); }}
    onMouseLeave={event => { if (!mobile && !event.currentTarget.contains(document.activeElement)) hide(); }}
    onBlurCapture={event => { if (!mobile && !event.currentTarget.contains(event.relatedTarget)) hide(); }}
  >
    <div className="dashboard-catalog-item-heading">
      <button type="button" className="dashboard-catalog-preview-trigger" disabled={disabled}
        aria-label={`${widget.title} 위젯 미리보기`} aria-expanded={visible}
        aria-controls={visible ? previewId : undefined}
        onFocus={() => { if (!mobile) onPreview(widget.id); }}
        onClick={() => onPreview(visible && mobile ? null : widget.id)}
      >
        <span className="dashboard-icon"><Icon name={widget.icon} /></span>
        <span><strong>{widget.title}</strong><small>{widget.description}</small></span>
      </button>
      <button type="button" className="dashboard-catalog-select" disabled={disabled}
        aria-pressed={added} aria-label={`${widget.title} ${added ? '제거' : '추가'}`}
        onClick={() => { if (!mobile) hide(); onToggle(); }}
      ><span className="dashboard-catalog-action">{added ? <Minus size={16} /> : <Plus size={16} />}{added ? '제거' : '추가'}</span></button>
    </div>
    {mobile && visible && <div id={previewId} className="dashboard-catalog-inline-preview"><DashboardWidgetPreview widget={widget} /></div>}
    {!mobile && visible && !disabled && <CalendarPopover anchorRef={anchor}
      id={previewId} width={['calendar', 'mywork'].includes(widget.id) ? 560 : 380}
      onClose={hide} className="widget-catalog-hover-preview"
    ><DashboardWidgetPreview widget={widget} /></CalendarPopover>}
  </div>;
}

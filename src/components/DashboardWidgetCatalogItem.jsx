import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import DashboardWidgetPreview from './DashboardWidgetPreview.jsx';
import Icon from './Icon.jsx';
import './widget-catalog-preview.css';

export default function DashboardWidgetCatalogItem({ widget, added, disabled, onToggle, preview, onPreview, mobile }) {
  const previewId = useId();
  const visible = preview === widget.id;
  return <div className={`dashboard-catalog-item ${added ? 'is-added' : ''} ${visible ? 'is-previewing' : ''}`}
    onMouseEnter={() => { if (!disabled && !mobile) onPreview(widget.id); }}
  >
    <div className="dashboard-catalog-item-heading">
      <button type="button" className="dashboard-catalog-preview-trigger" disabled={disabled}
        aria-label={`${widget.title} 위젯 미리보기`} aria-expanded={visible}
        aria-controls={mobile && visible ? previewId : undefined}
        onFocus={() => { if (!mobile) onPreview(widget.id); }}
        onClick={() => onPreview(visible && mobile ? null : widget.id)}
      >
        <span className="dashboard-icon"><Icon name={widget.icon} /></span>
        <span><strong>{widget.title}</strong><small>{widget.description}</small></span>
      </button>
      <button type="button" className="dashboard-catalog-select" disabled={disabled}
        aria-pressed={added} aria-label={`${widget.title} ${added ? '제거' : '추가'}`}
        onClick={onToggle}
      ><span className="dashboard-catalog-action">{added ? <Minus size={16} /> : <Plus size={16} />}{added ? '제거' : '추가'}</span></button>
    </div>
    {mobile && visible && <div id={previewId} className="dashboard-catalog-inline-preview"><DashboardWidgetPreview widget={widget} /></div>}
  </div>;
}

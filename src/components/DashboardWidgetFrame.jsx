import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';

export default function DashboardWidgetFrame({
  widget,
  index,
  count,
  editing,
  disabled = false,
  draggedId,
  dropId,
  onDrag,
  onDrop,
  onTarget,
  onMove,
  onRemove,
  children,
}) {
  return (
    <article
      className={`dashboard-widget widget-${widget.id} ${editing ? 'is-editing' : ''} ${dropId === widget.id ? 'is-drop-target' : ''} ${draggedId === widget.id ? 'is-dragging' : ''}`}
      data-widget-id={widget.id}
      onDragOver={(event) => {
        if (editing && !disabled && draggedId && draggedId !== widget.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          onTarget(widget.id);
        }
      }}
      onDrop={(event) => {
        if (!editing || disabled) return;
        event.preventDefault();
        event.stopPropagation();
        onDrop(
          event.dataTransfer.getData('text/plain') || draggedId,
          widget.id,
        );
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onTarget(null);
      }}
    >
      {editing && (
        <div className="dashboard-widget-controls">
          <button
            type="button"
            className="dashboard-drag-handle"
            disabled={disabled}
            draggable={!disabled}
            aria-label={`${widget.title} 위젯 드래그`}
            title="끌어서 순서 변경"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', widget.id);
              onDrag(widget.id);
            }}
            onDragEnd={() => onDrag(null)}
          >
            <GripVertical size={15} />
            <span>{widget.title}</span>
          </button>
          <button
            type="button"
            className="dashboard-icon-button"
            disabled={disabled || index === 0}
            onClick={() => onMove(index, -1)}
            aria-label={`${widget.title} 앞으로 이동`}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="dashboard-icon-button"
            disabled={disabled || index === count - 1}
            onClick={() => onMove(index, 1)}
            aria-label={`${widget.title} 뒤로 이동`}
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="dashboard-icon-button"
            disabled={disabled}
            onClick={() => onRemove(widget.id)}
            aria-label={`${widget.title} 위젯 제거`}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {children}
    </article>
  );
}

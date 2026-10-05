import { cloneElement, useEffect, useId, useRef } from 'react';
import { errorMessage } from '../lib/domain.js';
export function ErrorNotice({ error, onRetry }) {
  return error ? (
    <div className="inline-error" role="alert">
      <span>{errorMessage(error)}</span>
      {onRetry && <button onClick={onRetry}>다시 불러오기</button>}
    </div>
  ) : null;
}
export function ResourceState({ resource, children }) {
  if (resource.loading && resource.data == null)
    return (
      <p className="status-message" role="status">
        불러오는 중…
      </p>
    );
  if (resource.error)
    return <ErrorNotice error={resource.error} onRetry={resource.reload} />;
  return (
    <>
      {resource.loading && (
        <p className="field-help" role="status">
          최신 정보를 불러오는 중…
        </p>
      )}
      {children}
    </>
  );
}
export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
export function Field({ label, children, help }) {
  const fieldId = useId();
  return (
    <label className="form-field">
      <span id={`${fieldId}-label`} className="field-label">
        {label}
      </span>
      {cloneElement(children, {
        'aria-labelledby': `${fieldId}-label`,
        'aria-describedby': help ? `${fieldId}-help` : undefined,
      })}
      {help && (
        <span id={`${fieldId}-help`} className="field-help">
          {help}
        </span>
      )}
    </label>
  );
}
export function Modal({ title, onClose, busy, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) onClose();
      if (event.key === 'Tab') {
        const elements = [
          ...dialog.current.querySelectorAll(
            'button, input, select, textarea, a[href]',
          ),
        ].filter((element) => !element.disabled);
        const first = elements[0];
        const last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal real-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function FormActions({ busy, onCancel, label = '저장' }) {
  return (
    <div className="modal-actions">
      {onCancel && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onCancel}
        >
          취소
        </button>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? '처리 중…' : label}
      </button>
    </div>
  );
}

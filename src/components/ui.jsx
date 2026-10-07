import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { errorMessage } from '../lib/domain.js';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';
const ModalCloseContext = createContext(null);
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
      <div
        className="loading-placeholder"
        role="status"
        aria-label="불러오는 중"
      >
        <span>불러오는 중…</span>
        <div />
        <div />
        <div />
      </div>
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
export function Field({ label, children, help, error }) {
  const fieldId = useId();
  const [validationMessage, setValidationMessage] = useState('');
  const fieldError = error || validationMessage;
  return (
    <label className="form-field">
      <span className="field-label">
        <span id={`${fieldId}-label`}>{label}</span>
        {children.props.required && (
          <span className="required-label" aria-hidden="true">
            필수
          </span>
        )}
      </span>
      {cloneElement(children, {
        'aria-labelledby': `${fieldId}-label`,
        'aria-describedby':
          [help && `${fieldId}-help`, fieldError && `${fieldId}-error`]
            .filter(Boolean)
            .join(' ') || undefined,
        'aria-invalid': Boolean(fieldError),
        onInvalid: (event) => {
          const input = event.currentTarget;
          const message = input.validity.valueMissing
            ? `${label} 항목을 입력해 주세요.`
            : input.validity.rangeUnderflow
              ? `${input.min} 이상으로 입력해 주세요.`
              : input.validity.rangeOverflow
                ? `${input.max} 이하로 입력해 주세요.`
                : input.validity.patternMismatch || input.validity.typeMismatch
                  ? `${label} 형식을 확인해 주세요.`
                  : '입력한 값을 확인해 주세요.';
          setValidationMessage(message);
          children.props.onInvalid?.(event);
        },
        onChange: (event) => {
          setValidationMessage('');
          children.props.onChange?.(event);
        },
      })}
      {help && (
        <span id={`${fieldId}-help`} className="field-help">
          {help}
        </span>
      )}
      {fieldError && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">
          {fieldError}
        </span>
      )}
    </label>
  );
}
export function Modal({
  title,
  onClose,
  busy,
  children,
  wide = false,
  editor = false,
  dirty = false,
}) {
  const dialog = useRef(null);
  const titleId = useId();
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const { confirm } = useInteractions();
  useUnsavedChanges(dirty);
  const closeRef = useRef(null);
  closeRef.current = async () => {
    if (busyRef.current) return;
    if (
      dirty &&
      !(await confirm({
        title: '입력 내용 버리기',
        message:
          '저장하지 않은 변경 사항이 있습니다. 입력 내용을 버리고 닫을까요?',
        label: '버리고 닫기',
        danger: true,
      }))
    )
      return;
    onClose();
  };
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.focus();
    const onKey = (event) => {
      if (
        [...document.querySelectorAll('[role="dialog"]')].at(-1) !==
        dialog.current
      )
        return;
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
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
        className={`modal real-modal ${wide ? 'modal-wide' : ''} ${editor ? 'modal-editor' : ''}`}
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
            onClick={() => closeRef.current()}
          >
            ×
          </button>
        </div>
        <ModalCloseContext.Provider value={() => closeRef.current()}>
          <div className="modal-body">{children}</div>
        </ModalCloseContext.Provider>
      </section>
    </div>
  );
}
export function FormActions({
  busy,
  disabled = false,
  onCancel,
  label = '저장',
}) {
  const closeModal = useContext(ModalCloseContext);
  return (
    <div className="modal-actions">
      {onCancel && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={closeModal || onCancel}
        >
          취소
        </button>
      )}
      <button
        type="submit"
        className="primary-button"
        disabled={busy || disabled}
      >
        {busy ? '처리 중…' : label}
      </button>
    </div>
  );
}

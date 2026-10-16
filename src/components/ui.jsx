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
import useAppNavigate from '../hooks/useAppNavigate.js';
import { useLocation } from 'react-router';
const ModalCloseContext = createContext(null);
export function ErrorNotice({ error, onRetry }) {
  const unavailable = error?.status === 403 || error?.status === 404;
  const guidance = {
    401: '다시 로그인한 뒤 이용해 주세요.',
    403: '스페이스·팀 참여 상태와 이 화면을 볼 수 있는 역할을 확인해 주세요.',
    404: '목록으로 돌아가 대상이 남아 있는지 확인해 주세요.',
  }[error?.status];
  return error ? (
    <div className="inline-error" role="alert">
      <div className="error-notice-message">
        <p>{errorMessage(error)}</p>
        {guidance && <p className="error-notice-guidance">{guidance}</p>}
      </div>
      {onRetry && !unavailable && error.status !== 401 && (
        <button type="button" onClick={onRetry}>
          다시 불러오기
        </button>
      )}
    </div>
  ) : null;
}
export function ResourceState({ resource, children, label = '화면 정보' }) {
  const navigate = useAppNavigate();
  const { pathname } = useLocation();
  if (resource.loading && resource.data == null)
    return (
      <div
        className="loading-placeholder"
        role="status"
        aria-label={`${label} 불러오는 중`}
      >
        <span>{label} 불러오는 중…</span>
        <div aria-hidden="true" />
        <div aria-hidden="true" />
        <div aria-hidden="true" />
      </div>
    );
  if (resource.error) {
    const canReturnToSpaces =
      [403, 404].includes(resource.error.status) && !pathname.endsWith('/main');
    return (
      <div className="resource-error-state">
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
        {canReturnToSpaces && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/main')}
          >
            내 스페이스로 이동
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {resource.loading && (
        <p className="field-help" role="status">
          최신 정보를 불러오는 중… 이전 조회 결과를 표시하고 있습니다.
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
  const Container = children.type?.compositeField ? 'div' : 'label';
  const [validationMessage, setValidationMessage] = useState('');
  const fieldError = error || validationMessage;
  return (
    <Container className="form-field">
      <span className="field-label">
        <span id={`${fieldId}-label`}>{label}</span>
        {children.props.required && (
          <span className="required-label" aria-hidden="true">
            필수
          </span>
        )}
      </span>
      {cloneElement(children, {
        ...(children.type?.compositeField ? { labelText: label } : {}),
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
    </Container>
  );
}
export function Modal({
  title,
  onClose,
  busy,
  children,
  wide = false,
  editor = false,
  fullscreen = false,
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
        neutral: true,
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
        ].filter(
          (element) => !element.disabled && element.getClientRects().length,
        );
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
        className={`modal real-modal ${wide ? 'modal-wide' : ''} ${editor ? 'modal-editor' : ''} ${fullscreen ? 'modal-fullscreen' : ''}`}
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
  onBack,
}) {
  const closeModal = useContext(ModalCloseContext);
  return (
    <div className="modal-actions">
      {onBack && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onBack}
        >
          이전
        </button>
      )}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { InteractionContext } from '../hooks/useInteractions.js';
import { Modal } from './ui.jsx';

export default function InteractionProvider({ children }) {
  const [changedForms, setChangedForms] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState('');
  const pendingConfirmation = useRef(null);
  const changedFormsRef = useRef({});
  const hasChanges = Object.values(changedForms).some(Boolean);
  const registerChanges = useCallback((formId, changed) => {
    if (changed) changedFormsRef.current[formId] = true;
    else delete changedFormsRef.current[formId];
    setChangedForms((current) => {
      if (Boolean(current[formId]) === changed) return current;
      const next = { ...current };
      if (changed) next[formId] = true;
      else delete next[formId];
      return next;
    });
  }, []);
  const clearChanges = useCallback(() => {
    changedFormsRef.current = {};
    setChangedForms({});
  }, []);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        pendingConfirmation.current?.(false);
        pendingConfirmation.current = resolve;
        setConfirmation(options);
      }),
    [],
  );
  const finishConfirmation = (accepted) => {
    pendingConfirmation.current?.(accepted);
    pendingConfirmation.current = null;
    setConfirmation(null);
  };
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      Object.values(changedFormsRef.current).some(Boolean) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (!hasChanges) return;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasChanges]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const confirmDiscard = useCallback(async () => {
    if (!hasChanges) return true;
    const accepted = await confirm({
      title: '저장하지 않은 변경 사항',
      message: '저장하지 않은 입력이 있습니다. 변경 사항을 버리고 계속할까요?',
      label: '변경 사항 버리기',
      danger: true,
    });
    if (accepted) clearChanges();
    return accepted;
  }, [hasChanges, confirm, clearChanges]);
  const value = useMemo(
    () => ({
      confirm,
      notify: setNotice,
      registerChanges,
      confirmDiscard,
      clearChanges,
    }),
    [confirm, registerChanges, confirmDiscard, clearChanges],
  );
  return (
    <InteractionContext.Provider value={value}>
      {children}
      {notice && (
        <div className="success-toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="알림 닫기"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      )}
      {blocker.state === 'blocked' && !confirmation && (
        <Modal title="저장하지 않은 변경 사항" onClose={() => blocker.reset()}>
          <p>
            저장하지 않은 입력이 있습니다. 이 화면을 떠나면 변경 사항이
            사라집니다.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => blocker.reset()}
            >
              계속 작성
            </button>
            <button
              className="primary-button danger"
              onClick={() => {
                clearChanges();
                blocker.proceed();
              }}
            >
              변경 사항 버리고 이동
            </button>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => finishConfirmation(false)}
        >
          <p>{confirmation.message}</p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => finishConfirmation(false)}
            >
              취소
            </button>
            <button
              className={`primary-button ${confirmation.danger ? 'danger' : ''}`}
              onClick={() => finishConfirmation(true)}
            >
              {confirmation.label || '확인'}
            </button>
          </div>
        </Modal>
      )}
    </InteractionContext.Provider>
  );
}

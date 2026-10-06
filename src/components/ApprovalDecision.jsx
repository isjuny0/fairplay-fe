import { useState } from 'react';
import { approveCompletion, rejectCompletion } from '../api/approvals.js';
import { ErrorNotice, Field } from './ui.jsx';

export default function ApprovalDecision({
  approval,
  user,
  blocked = false,
  onChanged,
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (
    approval.status !== 'PENDING' ||
    approval.reviewerId !== user.id ||
    approval.requesterId === user.id
  )
    return null;
  const decide = async (decision) => {
    if (blocked) return;
    const trimmedReason = reason.trim();
    if (
      decision === 'reject' &&
      (trimmedReason.length < 10 || trimmedReason.length > 500)
    ) {
      setError(new Error('반려 사유를 10~500자로 작성해 주세요.'));
      return;
    }
    if (
      decision === 'approve' &&
      !window.confirm(
        '최신 산출물과 담당 배분·수행 설명을 확인했나요? 승인하면 작업이 완료되고 수정이 잠깁니다.',
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (decision === 'approve') await approveCompletion(approval.id);
      else await rejectCompletion(approval.id, trimmedReason);
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <h2>완료 검토</h2>
      <p>작업 설명·담당 배분·개인 수행 설명·최신 산출물을 확인해 주세요.</p>
      <Field label="반려 사유">
        <textarea
          disabled={busy || blocked}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <ErrorNotice error={error} onRetry={onChanged} />
      <div className="modal-actions">
        <button
          className="secondary-button"
          disabled={busy || blocked}
          onClick={() => decide('reject')}
        >
          반려
        </button>
        <button
          className="primary-button"
          disabled={busy || blocked}
          onClick={() => decide('approve')}
        >
          완료 승인
        </button>
      </div>
    </section>
  );
}

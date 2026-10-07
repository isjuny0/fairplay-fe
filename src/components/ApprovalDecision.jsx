import { useState } from 'react';
import { approveCompletion, rejectCompletion } from '../api/approvals.js';
import { ErrorNotice, Field } from './ui.jsx';
import { useInteractions } from '../hooks/useInteractions.js';

export default function ApprovalDecision({
  approval,
  user,
  blocked = false,
  onChanged,
}) {
  const { confirm, notify } = useInteractions();
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
      !(await confirm({
        title: '작업 완료 승인',
        message:
          '최신 산출물과 담당 배분·수행 설명을 확인했나요? 승인하면 작업이 완료되고 수정이 잠깁니다.',
        label: '승인 확정',
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      if (decision === 'approve') await approveCompletion(approval.id);
      else await rejectCompletion(approval.id, trimmedReason);
      notify(
        decision === 'approve'
          ? '작업 완료를 승인했습니다.'
          : '반려 사유를 전달했습니다.',
      );
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel task-next-action">
      <h2>완료 검토</h2>
      <p>작업 설명·담당 배분·개인 수행 설명·최신 산출물을 확인해 주세요.</p>
      <Field
        label="반려 사유"
        help="반려할 때만 10~500자로 작성해 주세요. 담당자가 수정할 내용을 구체적으로 적어주세요."
      >
        <textarea
          disabled={busy || blocked}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <p className="character-count">{reason.length} / 500자</p>
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

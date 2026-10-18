import { useEffect, useRef, useState } from 'react';
import { approveCompletion, rejectCompletion } from '../api/approvals.js';
import { formatDate, memberName } from '../lib/domain.js';
import { ErrorNotice, Field } from './ui.jsx';
import {
  useInteractions,
  useUnsavedChanges,
} from '../hooks/useInteractions.js';

export default function ApprovalDecision({
  approval,
  taskTitle,
  user,
  members,
  onReviewSection,
  blocked = false,
  onChanged,
}) {
  const { confirm, notify } = useInteractions();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const rejectButton = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reasonError, setReasonError] = useState('');
  const reasonInput = useRef(null);
  const canReview =
    approval.status === 'PENDING' &&
    approval.reviewerId === user.id &&
    approval.requesterId !== user.id;
  useUnsavedChanges(canReview && reason.trim().length > 0);
  useEffect(() => {
    setError(null);
  }, [approval]);
  useEffect(() => {
    if (rejecting) reasonInput.current?.focus();
  }, [rejecting]);
  if (!canReview) return null;
  const decide = async (decision) => {
    if (busy || blocked || !canReview) return;
    const trimmedReason = reason.trim();
    if (
      decision === 'reject' &&
      (trimmedReason.length < 10 || trimmedReason.length > 500)
    ) {
      setReasonError('반려 사유를 10~500자로 작성해 주세요.');
      reasonInput.current?.focus();
      return;
    }
    if (
      decision === 'approve' &&
      !(await confirm({
        title: '작업 완료 승인',
        message:
          '최신 산출물과 담당 배분·수행 설명을 확인했나요? 승인하면 작업이 완료되고 수정이 잠깁니다.' +
          (reason.trim()
            ? ' 작성한 반려 사유는 승인에 포함되지 않습니다.'
            : ''),
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
      setReason('');
      setReasonError('');
      onChanged();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="panel task-next-action approval-decision"
      aria-label="완료 검토"
    >
      <h2>완료 검토</h2>
      <dl className="approval-request-context">
        <div>
          <dt>요청자</dt>
          <dd>{memberName(members, approval.requesterId)}</dd>
        </div>
        <div>
          <dt>요청 시각</dt>
          <dd>{formatDate(approval.requestedAt)}</dd>
        </div>
      </dl>
      <p>작업 내용과 수행 결과를 확인한 뒤 완료 여부를 결정하세요.</p>
      <ol className="review-guide" aria-label="검토할 내용">
        {[
          ['작업 설명 확인', 'task-description-section'],
          ['담당 배분 확인', 'task-assignment-section'],
          ['수행 설명 확인', 'task-contributions-section'],
          ['산출물 확인', 'task-deliverables-section'],
        ].map(([label, target]) => (
          <li key={target}>
            <button
              type="button"
              className="text-button"
              onClick={() => onReviewSection(target)}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="approval-rejection" hidden={!rejecting}>
        <div className="section-heading">
          <h3>반려 사유 작성</h3>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRejecting(false);
              rejectButton.current?.focus();
            }}
          >
            사유 접기
          </button>
        </div>
        <Field
          label="반려 사유"
          error={reasonError}
          help="반려할 때만 10~500자로 작성해 주세요. 담당자가 수정할 내용을 구체적으로 적어주세요."
        >
          <textarea
            ref={reasonInput}
            disabled={busy || blocked}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError('');
            }}
          />
        </Field>
        <div className="approval-reason-status">
          {reason.trim() && (
            <p className="field-help" role="status">
              작성 중인 반려 사유는 아직 전달되지 않았습니다.
            </p>
          )}
          <p className="character-count">{reason.length} / 500자</p>
        </div>
      </div>
      {blocked && (
        <p className="notice" role="status">
          현재 팀 상태에서는 승인·반려할 수 없습니다. 팀 상태를 확인해 주세요.
        </p>
      )}
      <ErrorNotice
        error={error}
        onRetry={
          error?.status === 409 || error?.status >= 500 ? onChanged : undefined
        }
      />
      <div
        className="review-action-dock approval-decision-actions"
        role="group"
        aria-label="완료 검토 처리"
      >
        <div className="review-action-context">
          <strong>{taskTitle}</strong>
          <span>
            {memberName(members, approval.requesterId)}님의 완료 요청
            {reason.trim() ? ' · 미전송 반려 사유 있음' : ''}
          </span>
        </div>
        <div className="review-action-buttons">
          <button
            className="secondary-button"
            disabled={busy || blocked}
            ref={rejectButton}
            onClick={() => (rejecting ? decide('reject') : setRejecting(true))}
          >
            {rejecting ? '반려 확정' : '반려'}
          </button>
          <button
            className="primary-button"
            disabled={busy || blocked}
            onClick={() => decide('approve')}
          >
            완료 승인
          </button>
        </div>
      </div>
    </section>
  );
}

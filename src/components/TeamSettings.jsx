import { useState } from 'react';
import RefreshButton from './RefreshButton.jsx';
import {
  createTeamDeletionRequest,
  deleteTeam,
  leaveTeam,
  getTeamLeavePreview,
  updateTeamDeletionConsent,
} from '../api/teams.js';
import { formatDate, memberName, memberRole } from '../lib/domain.js';
import { ErrorNotice, Field, Modal, ResourceState } from './ui.jsx';

const deletionStatusLabels = {
  PENDING: '동의 진행 중',
  READY: '전원 동의 완료',
  INVALIDATED: '재동의 필요',
  CANCELLED: '요청 취소',
};
const consentLabels = {
  UNANSWERED: '미응답',
  AGREED: '동의',
  REJECTED: '반대',
};

export default function TeamSettings({
  team,
  space,
  user,
  members,
  deletionResource,
  onChanged,
  onRemoved,
}) {
  const [confirmation, setConfirmation] = useState(null);
  const [nextLeaderId, setNextLeaderId] = useState('');
  const [handoffRecipients, setHandoffRecipients] = useState({});
  const [leavePreview, setLeavePreview] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const request = deletionResource.data;
  const isLeader = team.leaderId === user.id;
  const requiredCount = request?.members.length ?? 0;
  const agreedCount =
    request?.members.filter((member) => member.decision === 'AGREED').length ??
    0;
  const myConsented =
    request?.members.find((member) => member.userId === user.id)?.decision ===
    'AGREED';
  const membershipLocked = Boolean(space.membershipLockedAt);
  const requestActive = ['PENDING', 'READY'].includes(request?.status);
  const requestUnavailable =
    deletionResource.loading || Boolean(deletionResource.error);
  const leaveBlockMessage = {
    MEMBERSHIP_LOCKED: '중간 평가 대상이 확정되어 탈퇴할 수 없습니다.',
    LAST_MEMBER_MUST_DELETE_TEAM: '마지막 팀원은 팀 삭제 절차를 이용해 주세요.',
  }[leavePreview?.blockReason];
  const handoffTasks = leavePreview?.handoffTasks ?? [];
  const canSubmitLeave = leavePreview && !leavePreview.blockReason &&
    (!leavePreview.requiresNextLeader || nextLeaderId) &&
    handoffTasks.every((task) => handoffRecipients[task.id] && task.version != null);
  const handoffOptions = leavePreview?.eligibleMembers.map((member) => (
    <option key={member.userId} value={member.userId}>
      {member.name} · 현재 미완료 {member.openTaskCount}건
    </option>
  ));
  const loadLeavePreview = async () => {
    setError(null);
    setLeavePreview(null);
    setNextLeaderId('');
    setHandoffRecipients({});
    setBusy(true);
    try {
      setLeavePreview(await getTeamLeavePreview(team.id));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };
  const openConfirmation = (type) => {
    setError(null);
    setAcknowledged(false);
    // 최종 삭제는 사용자가 확인한 요청의 버전으로만 전송한다.
    setConfirmation({ type, request });
    if (type === 'leave') loadLeavePreview();
  };
  const closeConfirmation = () => {
    setConfirmation(null);
    setError(null);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || (confirmation.type === 'leave' && !canSubmitLeave)) return;
    const type = confirmation.type;
    setBusy(true);
    setError(null);
    try {
      if (type === 'create') await createTeamDeletionRequest(team.id);
      else if (type === 'oppose')
        await updateTeamDeletionConsent(confirmation.request.id, false);
      else if (type === 'delete')
        await deleteTeam(
          team.id,
          confirmation.request.id,
          confirmation.request.version,
        );
      else if (type === 'leave')
        await leaveTeam(team.id, nextLeaderId, handoffTasks.map((task) => ({
          taskId: task.id, recipientId: handoffRecipients[task.id], expectedVersion: task.version,
        })));
      setConfirmation(null);
      if (type === 'delete' || type === 'leave') onRemoved();
      else onChanged();
    } catch (requestError) {
      setError(requestError);
      if (type === 'leave') setLeavePreview(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const agree = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateTeamDeletionConsent(request.id, true);
      onChanged();
    } catch (requestError) {
      setError(requestError);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const confirmationType = confirmation?.type;
  const confirmedRequest = confirmation?.request;
  const deleteConfirmationCurrent =
    request?.id === confirmedRequest?.id &&
    request?.version === confirmedRequest?.version &&
    request?.canDelete;
  return (
    <section className="stack team-settings">
      <div className="page-heading page-heading--compact">
        <div>
          <h1>팀 설정</h1>
        </div>
      </div>
      {membershipLocked && (
        <p className="notice">
          팀 구성이 고정되어 삭제 요청·동의·최종 삭제·탈퇴가 제한됩니다. 진행
          중인 삭제 요청에 반대하거나 동의를 철회하는 것은 가능합니다.
        </p>
      )}
      {!confirmation && <ErrorNotice error={error} />}
      <section className="panel settings-section team-deletion-section danger-zone">
        <div className="settings-section-heading">
          <h2>팀 삭제 동의</h2>
          <p>
            팀과 연결 자료를 함께 정리합니다. 현재 팀원 전원이 동의한 뒤 리더가
            최종 삭제합니다.
          </p>
        </div>
        <div className="settings-section-content">
          <div className="settings-section-toolbar">
            <ol className="lifecycle-steps" aria-label="팀 삭제 진행 단계">
              <li
                className={!requestActive ? 'active' : ''}
                aria-current={!requestActive ? 'step' : undefined}
              >
                1. 삭제 요청
              </li>
              <li
                className={request?.status === 'PENDING' ? 'active' : ''}
                aria-current={
                  request?.status === 'PENDING' ? 'step' : undefined
                }
              >
                2. 전원 동의
              </li>
              <li
                className={request?.status === 'READY' ? 'active' : ''}
                aria-current={request?.status === 'READY' ? 'step' : undefined}
              >
                3. 리더 최종 삭제
              </li>
            </ol>
            <RefreshButton
              label="현황 새로고침"
              disabled={busy || deletionResource.loading}
              onClick={deletionResource.reload}
            />
          </div>

          <ResourceState resource={deletionResource}>
            {request ? (
              <>
                <div className="deletion-summary">
                  <span
                    className={`deletion-status deletion-${request.status.toLowerCase()}`}
                  >
                    {deletionStatusLabels[request.status]}
                  </span>
                  <strong>
                    {agreedCount} / {requiredCount}명 동의
                  </strong>
                </div>
                <p className="field-help">
                  요청자 {memberName(members, request.requestedBy)} ·{' '}
                  {formatDate(request.requestedAt)}
                </p>
                <div className="deletion-scope">
                  <span>
                    작업 <strong>{request.taskCount}개</strong>
                  </span>
                  <span>
                    자료 <strong>{request.deliverableCount}개</strong>
                  </span>
                  <span>연결 파일 포함</span>
                </div>
                <ul
                  className="clean-list consent-list"
                  aria-label="팀원별 삭제 동의 현황"
                >
                  {request.members.map((member) => (
                    <li className="row-item" key={member.userId}>
                      <span>
                        <strong className={member.userId === user.id ? 'self-identity' : undefined}>
                          {member.name}
                        </strong>
                        {member.consentedAt && (
                          <small>{formatDate(member.consentedAt)}</small>
                        )}
                      </span>
                      <span
                        className={`consent-state consent-${member.decision.toLowerCase()}`}
                      >
                        {consentLabels[member.decision]}
                      </span>
                    </li>
                  ))}
                </ul>
                {request.workFrozen && (
                  <p className="notice">
                    삭제 동의 중에는 작업·수행 설명·자료·완료 검토를 변경할 수
                    없습니다. 조회와 파일 다운로드는 가능합니다.
                  </p>
                )}
                {request.status === 'INVALIDATED' && (
                  <p className="notice">
                    팀 구성 또는 삭제 대상이 변경되어 기존 동의가
                    무효화되었습니다. 리더가 새 요청을 만들면 모든 팀원이 다시
                    동의해야 합니다.
                  </p>
                )}
                {request.status === 'CANCELLED' && (
                  <p className="notice">
                    팀원의 반대 또는 동의 철회로 요청이 취소되었습니다. 작업을
                    다시 진행할 수 있습니다.
                  </p>
                )}
                {requestActive && (
                  <div className="heading-actions">
                    <button
                      className="primary-button"
                      disabled={
                        busy ||
                        requestUnavailable ||
                        membershipLocked ||
                        myConsented
                      }
                      onClick={agree}
                    >
                      {myConsented ? '내 동의 완료' : '팀 삭제에 동의'}
                    </button>
                    <button
                      className="secondary-button danger"
                      disabled={busy || requestUnavailable}
                      onClick={() => openConfirmation('oppose')}
                    >
                      {myConsented
                        ? '동의 철회 및 요청 취소'
                        : '삭제 반대 및 요청 취소'}
                    </button>
                  </div>
                )}
                {request.status === 'READY' && !isLeader && (
                  <p className="field-help">
                    전원이 동의했습니다. 리더의 최종 삭제를 기다리고 있습니다.
                  </p>
                )}
                {isLeader && requestActive && (
                  <button
                    className="secondary-button danger"
                    disabled={
                      busy ||
                      requestUnavailable ||
                      membershipLocked ||
                      !request.canDelete
                    }
                    onClick={() => openConfirmation('delete')}
                  >
                    팀 최종 삭제
                  </button>
                )}
              </>
            ) : (
              <p className="deletion-empty">
                진행 중인 팀 삭제 요청이 없습니다.
              </p>
            )}
            {isLeader && !requestActive && (
              <button
                className="secondary-button danger"
                disabled={busy || requestUnavailable || membershipLocked}
                onClick={() => openConfirmation('create')}
              >
                {request ? '새 삭제 요청 만들기' : '팀 삭제 요청 만들기'}
              </button>
            )}
            {!isLeader && !requestActive && (
              <p className="field-help">
                팀 삭제 요청은 리더가 만들 수 있습니다.
              </p>
            )}
          </ResourceState>
        </div>
      </section>
      <section className="panel settings-section team-leave-section">
        <div className="settings-section-heading">
          <h2>팀 탈퇴</h2>
          <p>
            미완료 담당 작업은 탈퇴 화면에서 인계합니다. 작성한 자료와 스페이스 소속은 유지됩니다.
          </p>
        </div>
        <div className="settings-section-content">
          {team.approvedMemberCount < 2 && (
            <p className="notice">
              마지막 팀원은 탈퇴할 수 없습니다. 위에서 삭제 요청을 만들고 본인
              동의 후 팀을 삭제해 주세요.
            </p>
          )}
          <button
            className="secondary-button danger"
            disabled={busy || membershipLocked || team.approvedMemberCount < 2}
            onClick={() => openConfirmation('leave')}
          >
            팀 탈퇴하기
          </button>
        </div>
      </section>
      {confirmation && (
        <Modal
          title={
            {
              create: '팀 삭제 요청 만들기',
              oppose: '삭제 요청 취소',
              delete: '팀 최종 삭제',
              leave: '팀 탈퇴',
            }[confirmationType]
          }
          busy={busy}
          onClose={closeConfirmation}
        >
          <form onSubmit={submit} className="stack">
            {confirmationType === 'create' && (
              <p>
                삭제 요청을 만들면 작업 변경이 중단됩니다. 리더도 별도로
                동의해야 하며, 한 명이라도 반대하거나 동의를 철회하면 요청이
                취소됩니다.
              </p>
            )}
            {confirmationType === 'oppose' && (
              <p>
                반대하거나 동의를 철회하면 이 삭제 요청 전체가 취소되고 작업을
                다시 진행할 수 있습니다. 삭제하려면 새 요청과 전원의 동의가
                필요합니다.
              </p>
            )}
            {confirmationType === 'delete' && (
              <>
                <p>
                  <strong>{team.name}</strong>과 작업{' '}
                  {confirmedRequest.taskCount}개, 자료{' '}
                  {confirmedRequest.deliverableCount}개 및 연결 파일을
                  완전히 삭제합니다. 복구할 수 없습니다.
                </p>
                <label className="confirmation-check">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    disabled={busy}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  삭제 범위와 복구 불가를 확인했습니다.
                </label>
                {!deleteConfirmationCurrent && (
                  <p className="notice">
                    동의 현황이 변경되었습니다. 창을 닫고 최신 현황을 확인한 뒤
                    다시 진행해 주세요.
                  </p>
                )}
              </>
            )}
            {confirmationType === 'leave' && (
              <>
                <p>
                  탈퇴하면 이 팀의 작업·자료 화면에 접근할 수 없습니다.
                  스페이스 소속은 유지됩니다.
                </p>
                {busy && !leavePreview && <p>탈퇴 영향을 확인하고 있습니다.</p>}
                {leaveBlockMessage && <p className="notice">{leaveBlockMessage}</p>}
                {Boolean(leavePreview?.completedTaskCount) && (
                  <p>완료 작업 {leavePreview.completedTaskCount}개의 담당·수행 기록은 팀에 남습니다.</p>
                )}
                {leavePreview?.requiresNextLeader && !leavePreview.blockReason && (
                  <Field
                    label="다음 리더"
                    help="현재 승인된 다른 팀원 중 한 명을 지정해 주세요."
                  >
                    <select
                      required
                      value={nextLeaderId}
                      disabled={busy}
                      onChange={(event) => setNextLeaderId(event.target.value)}
                    >
                      <option value="">다음 리더를 선택하세요</option>
                      {leavePreview.eligibleMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.name} · {memberRole(member)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {handoffTasks.length > 0 && !leavePreview.blockReason && (
                  <>
                    <p>인계할 미완료 작업 {handoffTasks.length}개</p>
                    <ul className="clean-list">
                      {handoffTasks.map((task) => (
                        <li key={task.id}>
                          <Field label={`${task.title} 인계 대상`}
                            help={`마감 ${formatDate(task.dueAt)} · 인계 비율 ${task.allocationPercent}%`}>
                            <select required disabled={busy} value={handoffRecipients[task.id] ?? ''}
                              onChange={(event) => {
                                const recipientId = event.target.value;
                                setHandoffRecipients((current) => ({ ...current, [task.id]: recipientId }));
                              }}>
                              <option value="">인계할 팀원을 선택하세요</option>
                              {handoffOptions}
                            </select>
                          </Field>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            <ErrorNotice error={error} />
            {confirmationType === 'leave' && error && !leavePreview && (
              <button type="button" className="secondary-button" disabled={busy} onClick={loadLeavePreview}>
                탈퇴 영향 다시 확인
              </button>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={closeConfirmation}
              >
                취소
              </button>
              <button
                type="submit"
                className="secondary-button danger"
                disabled={
                  busy ||
                  (confirmationType === 'create' &&
                    (!isLeader ||
                      membershipLocked ||
                      requestUnavailable ||
                      requestActive)) ||
                  (confirmationType === 'oppose' &&
                    (requestUnavailable ||
                      !requestActive ||
                      request?.id !== confirmedRequest.id)) ||
                  (confirmationType === 'delete' &&
                    (!isLeader ||
                      membershipLocked ||
                      requestUnavailable ||
                      !deleteConfirmationCurrent ||
                      !acknowledged)) ||
                  (confirmationType === 'leave' &&
                    (membershipLocked ||
                      team.approvedMemberCount < 2 ||
                      !canSubmitLeave))
                }
              >
                {busy
                  ? '처리 중…'
                  : {
                      create: '삭제 요청 생성',
                      oppose: '반대 및 요청 취소',
                      delete: '완전히 삭제',
                      leave: '탈퇴 확정',
                    }[confirmationType]}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

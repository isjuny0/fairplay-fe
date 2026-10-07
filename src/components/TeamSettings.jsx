import { useState } from 'react';
import {
  createTeamDeletionRequest,
  deleteTeam,
  leaveTeam,
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
  onNavigate,
}) {
  const [confirmation, setConfirmation] = useState(null);
  const [nextLeaderId, setNextLeaderId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const request = deletionResource.data;
  const isLeader = team.leaderId === user.id;
  const membershipLocked = Boolean(space.membershipLockedAt);
  const requestActive = ['PENDING', 'READY'].includes(request?.status);
  const requestUnavailable =
    deletionResource.loading || Boolean(deletionResource.error);
  const nextLeaders = members.filter((member) => member.userId !== user.id);
  const openConfirmation = (type) => {
    setError(null);
    setAcknowledged(false);
    setNextLeaderId('');
    // 최종 삭제는 사용자가 확인한 요청의 버전으로만 전송한다.
    setConfirmation({ type, request });
  };
  const closeConfirmation = () => {
    setConfirmation(null);
    setError(null);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
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
        await leaveTeam(team.id, isLeader ? nextLeaderId : undefined);
      setConfirmation(null);
      if (type === 'delete' || type === 'leave') onRemoved();
      else onChanged();
    } catch (requestError) {
      setError(requestError);
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
      <div className="page-heading">
        <div>
          <span className="eyebrow">팀의 마지막 단계</span>
          <h1>팀 설정</h1>
          <p>팀을 떠나거나, 모든 팀원의 동의를 받아 팀을 정리할 수 있습니다.</p>
        </div>
      </div>
      {membershipLocked && (
        <p className="notice">
          팀 구성이 고정되어 삭제 요청·동의·최종 삭제·탈퇴가 제한됩니다. 진행
          중인 삭제 요청에 반대하거나 동의를 철회하는 것은 가능합니다.
        </p>
      )}
      {!confirmation && <ErrorNotice error={error} />}
      <section className="panel stack danger-zone">
        <div className="section-heading">
          <h2>팀 삭제 동의</h2>
          <button
            className="secondary-button"
            disabled={busy || deletionResource.loading}
            onClick={deletionResource.reload}
          >
            현황 새로고침
          </button>
        </div>
        <ol className="lifecycle-steps" aria-label="팀 삭제 진행 단계">
          <li className={!requestActive ? 'active' : ''}>1. 삭제 요청</li>
          <li className={request?.status === 'PENDING' ? 'active' : ''}>
            2. 전원 동의
          </li>
          <li className={request?.status === 'READY' ? 'active' : ''}>
            3. 리더 최종 삭제
          </li>
        </ol>
        <p>
          팀 삭제는 현재 팀원 전원의 동의가 필요합니다. 동의가 모이면 리더가
          최종 삭제합니다.
        </p>
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
                  {request.agreedCount} / {request.requiredCount}명 동의
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
                  산출물 <strong>{request.deliverableCount}개</strong>
                </span>
                <span>연결 파일·승인 이력 포함</span>
              </div>
              <ul
                className="clean-list consent-list"
                aria-label="팀원별 삭제 동의 현황"
              >
                {request.members.map((member) => (
                  <li className="row-item" key={member.userId}>
                    <span>
                      <strong>
                        {member.name}
                        {member.userId === user.id && ' · 나'}
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
                  삭제 동의 중에는 작업·수행 설명·산출물·완료 검토를 변경할 수
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
                      request.myConsented
                    }
                    onClick={agree}
                  >
                    {request.myConsented ? '내 동의 완료' : '팀 삭제에 동의'}
                  </button>
                  <button
                    className="secondary-button danger"
                    disabled={busy || requestUnavailable}
                    onClick={() => openConfirmation('oppose')}
                  >
                    {request.myConsented
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
            <p className="deletion-empty">진행 중인 팀 삭제 요청이 없습니다.</p>
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
      </section>
      <section className="panel stack danger-zone">
        <h2>팀 탈퇴</h2>
        <ol className="handoff-checklist">
          <li>담당 작업·승인 역할·팀 공용 산출물을 인계합니다.</li>
          <li>리더라면 다음 리더를 직접 선택합니다.</li>
          <li>탈퇴 조건을 확인한 뒤 팀에서 탈퇴합니다.</li>
        </ol>
        <p>
          팀에서만 탈퇴하며 스페이스 소속과 계정은 유지됩니다.
          {isLeader && ' 리더는 다음 리더를 직접 지정해야 합니다.'}
        </p>
        <p className="field-help">
          담당 작업(완료 작업 포함), 승인 대기 요청·검토, 진행할 작업의 승인자
          지정, 본인이 작성한 팀 공용 산출물이 남아 있으면 탈퇴할 수 없습니다.
          먼저 역할을 인계하고 자료를 정리해 주세요.
        </p>
        <div className="heading-actions">
          <button
            className="secondary-button"
            onClick={() => onNavigate('작업 보드')}
          >
            담당 작업 확인
          </button>
          <button
            className="secondary-button"
            onClick={() => onNavigate('산출물')}
          >
            공용 산출물 확인
          </button>
        </div>
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
                  {confirmedRequest.taskCount}개, 산출물{' '}
                  {confirmedRequest.deliverableCount}개 및 연결 파일·승인 이력을
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
                  탈퇴하면 이 팀의 작업·산출물·승인 화면에 접근할 수 없습니다.
                  스페이스 소속은 유지됩니다.
                </p>
                {isLeader && (
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
                      {nextLeaders.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.name} · {memberRole(member)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
            <ErrorNotice error={error} />
            {error?.code === 'TEAM_LEAVE_HAS_DEPENDENCIES' && (
              <p className="field-help">
                창을 닫고 담당 작업·승인 요청·공용 산출물을 확인해 주세요. 완료
                작업에 담당자로 남아 있는 경우에도 탈퇴가 제한됩니다.
              </p>
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
                      (isLeader &&
                        !nextLeaders.some(
                          (member) => member.userId === nextLeaderId,
                        ))))
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

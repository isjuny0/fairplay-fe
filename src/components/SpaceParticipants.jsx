import { useEffect, useId, useRef, useState } from "react";
import { getManagerDashboard } from "../api/dashboard.js";
import {
  listSpaceParticipants,
  removeSpaceParticipant,
} from "../api/spaceParticipants.js";
import useResource from "../hooks/useResource.js";
import { useInteractions } from "../hooks/useInteractions.js";
import { participantRemovalHint } from "../lib/spaceParticipants.js";
import { formatDate } from "../lib/domain.js";
import { ErrorNotice, ResourceState } from "./ui.jsx";
import RefreshButton from "./RefreshButton.jsx";
import CalendarPopover from "./CalendarPopover.jsx";
import "../space-participants.css";

function ParticipantRemovalButton({ name, reason, disabled, deleting, onRemove }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const id = useId();
  return (
    <span className="participant-removal-actions"
      onMouseEnter={() => { if (reason) setOpen(true); }}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}>
      <button ref={trigger} type="button" className="secondary-button danger participant-removal-button"
        aria-label={`${name} 참여자 삭제`} aria-disabled={reason ? true : undefined}
        disabled={!reason && disabled}
        aria-describedby={open && reason ? id : undefined}
        onFocus={() => { if (reason) setOpen(true); }} onBlur={() => setOpen(false)}
        onClick={() => { if (reason) setOpen(true); else if (!disabled) onRemove(); }}>
        {deleting ? "삭제 중…" : "삭제"}
      </button>
      {open && reason && (
        <CalendarPopover id={id} role="tooltip" anchorRef={trigger} width={280} fitContent
          onClose={() => setOpen(false)} className="participant-removal-tooltip">
          {reason}
        </CalendarPopover>
      )}
    </span>
  );
}

export default function SpaceParticipants({ space, user, onChanged }) {
  const resource = useResource(
    () => listSpaceParticipants(space.id),
    [space.id],
  );
  const [pendingId, setPendingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const { confirm, notify } = useInteractions();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const accessError =
    [401, 403].includes(error?.status) || error?.code === "SPACE_NOT_FOUND"
      ? error
      : resource.error;
  const members = Array.isArray(resource.data) ? resource.data : [];
  const nameCounts = new Map();
  for (const member of members)
    nameCounts.set(member.name, (nameCounts.get(member.name) || 0) + 1);

  const remove = async (member) => {
    if (
      inFlight.current ||
      resource.loading ||
      accessError ||
      participantRemovalHint(member, user.id)
    )
      return;
    inFlight.current = true;
    setPendingId(member.userId);
    setError(null);
    try {
      const accepted = await confirm({
        title: "참여자 삭제",
        message: `“${member.name}” 참여자를 삭제할까요? 이 스페이스 접근과 소속 팀·가입 신청이 해제됩니다. 사용자 계정과 다른 스페이스 소속은 유지됩니다.`,
        label: "삭제",
        danger: true,
      });
      if (!accepted || !active.current) return;
      setDeleting(true);
      await removeSpaceParticipant(space.id, member.userId);
      if (!active.current) return;
      notify("참여자를 삭제했습니다.");
      resource.reload();
      onChanged();
      try {
        await getManagerDashboard(space.id);
      } catch (summaryError) {
        if (active.current)
          setError(
            [401, 403].includes(summaryError.status)
              ? summaryError
              : new Error(
                  "참여자는 삭제되었지만 대시보드 집계를 새로 불러오지 못했습니다. 대시보드에서 새로고침해 주세요.",
                ),
          );
      }
    } catch (requestError) {
      if (!active.current) return;
      setError(requestError);
      if (
        requestError.status === 409 ||
        requestError.code === "SPACE_MEMBER_NOT_FOUND"
      )
        resource.reload();
    } finally {
      inFlight.current = false;
      if (active.current) {
        setPendingId(null);
        setDeleting(false);
      }
    }
  };

  return (
    <section className="stack space-operation-page space-participants-page" aria-label="참여자 관리">
      <div className="page-heading">
        <h1>참여자 관리</h1>
        <RefreshButton
          disabled={pendingId != null || resource.loading}
          onClick={() => {
            setError(null);
            resource.reload();
          }}
        />
      </div>
      <ErrorNotice error={accessError === error ? null : error} />
      <ResourceState
        resource={{ ...resource, error: accessError }}
        label="참여자 목록"
      >
        {resource.data && (
          <>
            <div className="participant-count">총 {members.length}명</div>
            {members.length === 0 ? (
              <p className="participant-empty">참여자가 없습니다.</p>
            ) : (
              <table className="participant-table">
                <caption className="sr-only">스페이스 참여자 목록</caption>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>스페이스 역할</th>
                    <th>소속 팀</th>
                    <th>팀 역할</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const hint = participantRemovalHint(member, user.id);
                    const duplicateName = nameCounts.get(member.name) > 1;
                    return (
                      <tr key={member.userId}>
                        <td data-label="이름" className="participant-name">
                          <strong className={member.userId === user.id ? "self-identity" : undefined}>
                            {member.name}
                          </strong>
                          {duplicateName && (
                            <small title={member.userId}>
                              ID {member.userId.slice(-8)}
                            </small>
                          )}
                        </td>
                        <td data-label="스페이스 역할">
                          {member.role === "MANAGER" ? "관리자" : "참여자"}
                        </td>
                        <td data-label="소속 팀">
                          {member.team?.teamName || "미소속"}
                        </td>
                        <td data-label="팀 역할" className="participant-advanced">
                          {member.team
                            ? member.team.role === "LEADER"
                              ? "리더"
                              : "팀원"
                            : "—"}
                        </td>
                        <td data-label="가입일" className="participant-advanced">
                          <time dateTime={member.joinedAt}>
                            {formatDate(member.joinedAt)}
                          </time>
                        </td>
                        <td data-label="관리" className="participant-advanced">
                          <ParticipantRemovalButton name={member.name} reason={hint}
                            disabled={pendingId != null || resource.loading || !!accessError}
                            deleting={deleting && pendingId === member.userId}
                            onRemove={() => remove(member)} />
                        </td>
                        <td className="participant-mobile-details" colSpan={3}>
                          <details>
                            <summary>가입 정보·관리</summary>
                            <dl>
                              <div><dt>팀 역할</dt><dd>{member.team ? member.team.role === 'LEADER' ? '리더' : '팀원' : '—'}</dd></div>
                              <div><dt>가입일</dt><dd><time dateTime={member.joinedAt}>{formatDate(member.joinedAt)}</time></dd></div>
                            </dl>
                            <ParticipantRemovalButton name={member.name} reason={hint}
                              disabled={pendingId != null || resource.loading || !!accessError}
                              deleting={deleting && pendingId === member.userId}
                              onRemove={() => remove(member)} />
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </ResourceState>
    </section>
  );
}

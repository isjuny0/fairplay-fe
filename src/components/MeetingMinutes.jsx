import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  assertMeetingTeam,
  deleteMeetingMinute,
  getMeetingMinute,
  listMeetingMinutes,
} from "../api/meetingMinutes.js";
import useAppNavigate from "../hooks/useAppNavigate.js";
import useResource from "../hooks/useResource.js";
import { useInteractions } from "../hooks/useInteractions.js";
import { formatDate } from "../lib/domain.js";
import { isMeetingConflict, meetingSections } from "../lib/meetingMinutes.js";
import { teamMenuPath } from "../lib/routes.js";
import MeetingMinuteEditor from "./MeetingMinuteEditor.jsx";
import MarkdownBody from "./MarkdownBody.jsx";
import RefreshButton from "./RefreshButton.jsx";
import { EmptyState, ErrorNotice, ResourceState } from "./ui.jsx";
import "../meeting-minutes.css";

const PAGE_SIZE = 20;

export default function MeetingMinutes({
  context: { team, space, members },
  meetingMinuteId = null,
}) {
  const navigate = useAppNavigate(),
    location = useLocation();
  const value = new URLSearchParams(location.search).get("page") || "0";
  const page =
    /^\d+$/.test(value) && Number(value) <= 2147483647 ? Number(value) : 0;
  const base = teamMenuPath(space.id, team.id, "팀 회의록");
  const query = page ? `?page=${page}` : "";
  const { confirm, notify } = useInteractions();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(null),
    [accessError, setAccessError] = useState(null);
  const active = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const resource = useResource(async () => {
    if (meetingMinuteId != null)
      return assertMeetingTeam(
        await getMeetingMinute(meetingMinuteId),
        team.id,
      );
    const items = await listMeetingMinutes(team.id, page, PAGE_SIZE);
    items.forEach((item) => assertMeetingTeam(item, team.id));
    const next =
      items.length === PAGE_SIZE && page < 2147483647
        ? await listMeetingMinutes(team.id, page + 1, PAGE_SIZE)
        : [];
    next.forEach((item) => assertMeetingTeam(item, team.id));
    return { items, hasNext: next.length > 0 };
  }, [team.id, meetingMinuteId, page]);
  useEffect(() => {
    if (
      meetingMinuteId == null &&
      page > 0 &&
      resource.data?.items.length === 0
    )
      navigate(
        `${base}${location.state?.meetingMinuteDeleted && page > 1 ? `?page=${page - 1}` : ""}`,
        {
          replace: true,
        },
      );
  }, [
    meetingMinuteId,
    page,
    resource.data,
    base,
    location.state?.meetingMinuteDeleted,
  ]);
  const failure = accessError || resource.error;
  const blocked =
    team.workFrozen ||
    team.workStateUnknown ||
    busy ||
    resource.loading ||
    Boolean(failure) ||
    error?.code === "TEAM_DELETION_IN_PROGRESS";
  const remove = async () => {
    if (inFlight.current || blocked || !resource.data) return;
    inFlight.current = true;
    const item = resource.data;
    try {
      const accepted = await confirm({
        title: "팀 회의록 삭제",
        message: `“${item.title}” 회의록을 삭제할까요? 삭제한 내용과 참석자 기록은 복구할 수 없습니다.`,
        label: "삭제",
      });
      if (!active.current || !accepted) return;
      setBusy(true);
      setError(null);
      await deleteMeetingMinute(item.id, item.version);
      if (!active.current) return;
      notify("팀 회의록을 삭제했습니다.");
      navigate(`${base}${query}`, {
        replace: true,
        state: { meetingMinuteDeleted: true },
      });
    } catch (failure) {
      if (!active.current) return;
      setError(failure);
      if (
        [401, 403].includes(failure.status) &&
        failure.code !== "INVALID_CSRF_TOKEN"
      )
        setAccessError(failure);
      if (isMeetingConflict(failure)) {
        notify(
          "다른 팀원이 수정했습니다. 최신 내용을 확인한 뒤 다시 삭제해 주세요.",
        );
        resource.reload();
      } else if (failure.status === 404) resource.reload();
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <section className="stack meeting-minutes-page">
      {meetingMinuteId != null && (
        <div className="meeting-detail-toolbar">
          <button
            className="text-button"
            onClick={() => navigate(`${base}${query}`)}
          >
            팀 회의록
          </button>
          <button
            className="secondary-button"
            onClick={() => navigate(`${base}${query}`)}
          >
            ← 목록으로
          </button>
        </div>
      )}
      <div className="page-heading">
        <div>
          <h1>
            {meetingMinuteId == null
              ? "팀 회의록"
              : (!failure && resource.data?.title) || "팀 회의록"}
          </h1>
        </div>
        <div className="heading-actions">
          <RefreshButton
            label="회의록 새로고침"
            disabled={resource.loading || busy}
            onClick={() => {
              setError(null);
              resource.reload();
            }}
          />
          {meetingMinuteId == null && (
            <button
              className="primary-button"
              disabled={blocked}
              onClick={() => setEditing(true)}
            >
              회의록 등록
            </button>
          )}
        </div>
      </div>
      <ErrorNotice error={error} />
      <ResourceState
        resource={{ ...resource, error: failure }}
        label="팀 회의록"
      >
        {resource.data &&
          (meetingMinuteId == null ? (
            <>
              {resource.data.items.length ? (
                <div
                  className="meeting-list"
                  role="list"
                  aria-label="팀 회의록 목록"
                >
                  {resource.data.items.map((item) => (
                    <article
                      className="meeting-list-item"
                      role="listitem"
                      key={item.id}
                    >
                      <div className="meeting-list-title">
                        <button
                          className="text-button"
                          onClick={() => navigate(`${base}/${item.id}${query}`)}
                        >
                          {item.title}
                        </button>
                        <span className="field-help">
                          최초 작성 {item.authorName}
                        </span>
                      </div>
                      <time dateTime={item.meetingAt}>
                        {formatDate(item.meetingAt)}
                      </time>
                      <span className="meeting-attendee-count">
                        참석자 {item.attendeeCount}명
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>등록된 팀 회의록이 없습니다.</EmptyState>
              )}
              <nav
                className="meeting-pagination"
                aria-label="회의록 목록 페이지"
              >
                <button
                  className="secondary-button"
                  disabled={page === 0 || resource.loading}
                  onClick={() =>
                    navigate(`${base}${page > 1 ? `?page=${page - 1}` : ""}`)
                  }
                >
                  이전
                </button>
                <span>{page + 1}페이지</span>
                <button
                  className="secondary-button"
                  disabled={!resource.data.hasNext || resource.loading}
                  onClick={() => navigate(`${base}?page=${page + 1}`)}
                >
                  다음
                </button>
              </nav>
            </>
          ) : (
            <article className="meeting-detail">
              <dl className="meeting-metadata">
                <div>
                  <dt>회의일시</dt>
                  <dd>{formatDate(resource.data.meetingAt)}</dd>
                </div>
                <div>
                  <dt>최초 작성자</dt>
                  <dd>{resource.data.authorName}</dd>
                </div>
                <div>
                  <dt>등록일시</dt>
                  <dd>{formatDate(resource.data.createdAt)}</dd>
                </div>
                <div>
                  <dt>수정일시</dt>
                  <dd>{formatDate(resource.data.updatedAt)}</dd>
                </div>
              </dl>
              <section className="meeting-attendees" aria-label="회의 참석자">
                <h2>
                  참석자{" "}
                  <span className="field-help">
                    {resource.data.attendees.length}명
                  </span>
                </h2>
                <div className="meeting-attendee-chips">
                  {resource.data.attendees.length ? (
                    resource.data.attendees.map((person) => (
                      <span key={person.userId} title={person.userId}>
                        {person.name}
                        {!members.some(
                          (member) => member.userId === person.userId,
                        ) && <small> · 이전 참석자</small>}
                      </span>
                    ))
                  ) : (
                    <p className="field-help">기록된 참석자가 없습니다.</p>
                  )}
                </div>
              </section>
              {meetingSections.map(([key, label]) => (
                <section
                  className="meeting-content-section"
                  key={key}
                  aria-label={label}
                >
                  <h2>{label}</h2>
                  {resource.data[key] ? (
                    <MarkdownBody>{resource.data[key]}</MarkdownBody>
                  ) : (
                    <p className="field-help">작성된 {label}이 없습니다.</p>
                  )}
                </section>
              ))}
              <div className="meeting-detail-actions">
                <button
                  className="secondary-button"
                  disabled={blocked}
                  onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}
                >
                  회의록 수정
                </button>
                <button
                  className="secondary-button danger"
                  disabled={blocked}
                  onClick={remove}
                >
                  회의록 삭제
                </button>
              </div>
            </article>
          ))}
      </ResourceState>
      {editing && !failure && (
        <MeetingMinuteEditor
          team={team}
          members={members}
          initial={meetingMinuteId == null ? null : resource.data}
          onClose={() => setEditing(false)}
          onAccessError={(failure) => {
            setAccessError(failure);
            setEditing(false);
          }}
          onSaved={(saved) => {
            setEditing(false);
            notify(
              meetingMinuteId == null
                ? "팀 회의록을 등록했습니다."
                : "팀 회의록을 수정했습니다.",
            );
            if (meetingMinuteId == null) navigate(`${base}/${saved.id}`);
            else resource.reload();
          }}
        />
      )}
    </section>
  );
}

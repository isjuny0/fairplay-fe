import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ApiError } from "../api/client.js";
import {
  deleteSpaceAnnouncement,
  getSpaceAnnouncement,
  listSpaceAnnouncements,
} from "../api/spaceAnnouncements.js";
import useResource from "../hooks/useResource.js";
import useAppNavigate from "../hooks/useAppNavigate.js";
import { useInteractions } from "../hooks/useInteractions.js";
import { announcementPath, announcementsPath } from "../lib/routes.js";
import {
  announcementPage,
  isAnnouncementConflict,
} from "../lib/spaceAnnouncements.js";
import { formatDate } from "../lib/domain.js";
import AnnouncementList from "./AnnouncementList.jsx";
import AnnouncementEditor from "./AnnouncementEditor.jsx";
import { ErrorNotice, ResourceState } from "./ui.jsx";
import "../space-announcements.css";

const PAGE_SIZE = 20;

export default function SpaceAnnouncements({ space, announcementId = null }) {
  const navigate = useAppNavigate();
  const location = useLocation();
  const page = announcementPage(location.search);
  const base = announcementsPath(space.id);
  const query = page ? `?page=${page}` : "";
  const isManager = space.myRole === "MANAGER";
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const { confirm, notify } = useInteractions();
  const resource = useResource(async () => {
    if (announcementId == null)
      return listSpaceAnnouncements(space.id, page, PAGE_SIZE);
    const item = await getSpaceAnnouncement(space.id, announcementId);
    if (item.spaceId !== space.id)
      throw new ApiError(403, {
        code: "FORBIDDEN",
        message: "이 스페이스의 공지가 아닙니다.",
      });
    return item;
  }, [space.id, announcementId, page]);
  const next = useResource(
    () =>
      announcementId == null && resource.data?.length === PAGE_SIZE
        ? listSpaceAnnouncements(space.id, page + 1, PAGE_SIZE)
        : Promise.resolve([]),
    [space.id, announcementId, page, resource.data],
  );
  const accessError = [401, 403].includes(next.error?.status)
    ? next.error
    : resource.error;
  const canManage = isManager && ![401, 403, 404].includes(accessError?.status);
  useEffect(() => {
    if (announcementId == null && page > 0 && resource.data?.length === 0)
      navigate(
        `${base}${location.state?.announcementDeleted && page > 1 ? `?page=${page - 1}` : ""}`,
        { replace: true },
      );
  }, [
    announcementId,
    page,
    resource.data,
    base,
    location.state?.announcementDeleted,
  ]);
  const remove = async () => {
    if (busy || !isManager || !resource.data) return;
    const item = resource.data;
    if (
      !(await confirm({
        title: "공지 삭제",
        message: `“${item.title}” 공지를 삭제할까요? 삭제한 공지는 복구할 수 없습니다.`,
        label: "삭제",
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteSpaceAnnouncement(space.id, item.id, item.version);
      if (!active.current) return;
      notify("공지사항을 삭제했습니다.");
      navigate(`${base}${query}`, {
        replace: true,
        state: { announcementDeleted: true },
      });
    } catch (deleteError) {
      if (!active.current) return;
      setError(deleteError);
      if (isAnnouncementConflict(deleteError)) {
        notify(
          "다른 관리자가 공지를 변경했습니다. 최신 내용을 확인한 뒤 다시 삭제해 주세요.",
        );
        resource.reload();
      } else if (deleteError.status === 404) resource.reload();
    } finally {
      setBusy(false);
    }
  };
  const onSaved = (saved) => {
    setEditing(false);
    notify(
      announcementId == null
        ? "공지사항을 등록했습니다."
        : "공지사항을 수정했습니다.",
    );
    if (announcementId == null)
      navigate(`${announcementPath(space.id, saved.id)}${query}`);
    else resource.reload();
  };
  return (
    <>
      {announcementId != null && (
        <nav
          className="workspace-breadcrumb announcement-breadcrumb"
          aria-label="현재 위치"
        >
          <button onClick={() => navigate(`${base}${query}`)}>공지사항</button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">
            {!accessError && resource.data?.title
              ? resource.data.title
              : resource.loading
                ? "불러오는 중…"
                : "공지 상세"}
          </span>
        </nav>
      )}
      <section
        className={`stack announcements-page${announcementId == null ? " is-list" : ""}`}
      >
        {announcementId != null && (
          <button
            className="secondary-button back-button announcement-back-button"
            onClick={() => navigate(`${base}${query}`)}
          >
            ← 목록으로
          </button>
        )}
        <div className="page-heading">
          <h1>{announcementId == null ? "공지사항" : "공지 상세"}</h1>
          <div className="heading-actions">
            <button
              className="secondary-button"
              disabled={resource.loading || busy}
              onClick={() => {
                setError(null);
                resource.reload();
              }}
            >
              새로고침
            </button>
            {canManage && announcementId == null && (
              <button
                className="primary-button"
                disabled={resource.loading && !resource.data}
                onClick={() => setEditing(true)}
              >
                공지 작성
              </button>
            )}
          </div>
        </div>
        <ErrorNotice error={error} />
        <ResourceState
          resource={{ ...resource, error: accessError }}
          label="공지사항"
        >
          {resource.data &&
            (announcementId == null ? (
              <>
                {resource.data.length ? (
                  <AnnouncementList
                    items={resource.data}
                    onOpen={(id) =>
                      navigate(`${announcementPath(space.id, id)}${query}`)
                    }
                  />
                ) : (
                  <p className="announcement-empty">
                    등록된 공지사항이 없습니다.
                  </p>
                )}
                <ErrorNotice error={next.error} onRetry={next.reload} />
                <nav
                  className="announcement-pagination"
                  aria-label="공지 목록 페이지"
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
                    disabled={
                      resource.loading || next.loading || !next.data?.length
                    }
                    onClick={() => navigate(`${base}?page=${page + 1}`)}
                  >
                    다음
                  </button>
                </nav>
              </>
            ) : (
              <article className="announcement-detail">
                <header className="announcement-detail-heading">
                  {resource.data.pinned && (
                    <span className="announcement-pin">상단 고정</span>
                  )}
                  <h2>{resource.data.title}</h2>
                  <div className="announcement-metadata">
                    <span>{resource.data.authorName}</span>
                    <time dateTime={resource.data.createdAt}>
                      등록 {formatDate(resource.data.createdAt)}
                    </time>
                    {resource.data.updatedAt !== resource.data.createdAt && (
                      <time dateTime={resource.data.updatedAt}>
                        수정 {formatDate(resource.data.updatedAt)}
                      </time>
                    )}
                  </div>
                </header>
                <p className="announcement-content">{resource.data.content}</p>
                {canManage && (
                  <div className="announcement-detail-actions">
                    <button
                      className="secondary-button"
                      disabled={busy || resource.loading}
                      onClick={() => {
                        setError(null);
                        setEditing(true);
                      }}
                    >
                      공지 수정
                    </button>
                    <button
                      className="secondary-button danger"
                      disabled={busy || resource.loading}
                      onClick={remove}
                    >
                      공지 삭제
                    </button>
                  </div>
                )}
              </article>
            ))}
        </ResourceState>
        {editing && canManage && (
          <AnnouncementEditor
            spaceId={space.id}
            announcement={announcementId == null ? null : resource.data}
            onClose={() => setEditing(false)}
            onSaved={onSaved}
          />
        )}
      </section>
    </>
  );
}

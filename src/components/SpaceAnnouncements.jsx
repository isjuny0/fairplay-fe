import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { useLocation } from "react-router";
import { ApiError } from "../api/client.js";
import {
  downloadSpaceAnnouncementAttachment,
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
  announcementQuery,
  announcementSearch,
  filterAnnouncements,
  isAnnouncementConflict,
} from "../lib/spaceAnnouncements.js";
import { formatDate } from "../lib/domain.js";
import AnnouncementList from "./AnnouncementList.jsx";
import AnnouncementEditor from "./AnnouncementEditor.jsx";
import RefreshButton from "./RefreshButton.jsx";
import Icon from "./Icon.jsx";
import { ErrorNotice, ResourceState } from "./ui.jsx";
import "../space-announcements.css";

const PAGE_SIZE = 20;

export default function SpaceAnnouncements({ space, announcementId = null }) {
  const navigate = useAppNavigate();
  const location = useLocation();
  const page = announcementPage(location.search);
  const search = announcementSearch(location.search);
  const [searchInput, setSearchInput] = useState(search);
  const searchField = useRef(null);
  useEffect(() => setSearchInput(search), [search]);
  const base = announcementsPath(space.id);
  const query = announcementQuery(page, search);
  const isManager = space.myRole === "MANAGER";
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
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
  const accessError = resource.error;
  const canManage = isManager && ![401, 403, 404].includes(accessError?.status);
  useEffect(() => {
    if (announcementId == null && page > 0 && resource.data?.items?.length === 0)
      navigate(
        `${base}${announcementQuery(location.state?.announcementDeleted && page > 1 ? page - 1 : 0, search)}`,
        { replace: true },
      );
  }, [
    announcementId,
    page,
    resource.data,
    base,
    location.state?.announcementDeleted,
    search,
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
  const downloadAttachment = async (item, selectedAttachments) => {
    const attachments = Array.isArray(selectedAttachments)
      ? selectedAttachments
      : [selectedAttachments];
    const key = String(item.id);
    setDownloadingId(key);
    setError(null);
    try {
      const files = await Promise.all(attachments.map(async (attachment) => ({
        attachment,
        blob: await downloadSpaceAnnouncementAttachment(
          space.id,
          item.id,
          attachment.id,
        ),
      })));
      let blob;
      let filename;
      if (files.length === 1) {
        blob = files[0].blob;
        filename = files[0].attachment.originalFilename;
      } else {
        const archive = new JSZip();
        const usedNames = new Set();
        for (const { attachment, blob: fileBlob } of files) {
          const originalName = (attachment.originalFilename || "첨부파일")
            .split(/[\\/]/)
            .pop()
            .replace(/[\u0000-\u001f]/g, "-");
          const extensionIndex = originalName.lastIndexOf(".");
          const basename = extensionIndex > 0 ? originalName.slice(0, extensionIndex) : originalName;
          const extension = extensionIndex > 0 ? originalName.slice(extensionIndex) : "";
          let archiveName = originalName;
          let suffix = 2;
          while (usedNames.has(archiveName)) archiveName = `${basename} (${suffix++})${extension}`;
          usedNames.add(archiveName);
          archive.file(archiveName, fileBlob);
        }
        blob = await archive.generateAsync({ type: "blob", compression: "DEFLATE" });
        const safeTitle = (item.title || "공지 첨부파일")
          .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
          .trim() || "공지 첨부파일";
        filename = `${safeTitle}-첨부파일.zip`;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError);
    } finally {
      setDownloadingId(null);
    }
  };
  const visibleItems = announcementId == null && resource.data
    ? filterAnnouncements(resource.data.items, search)
    : [];
  const totalPages = Math.max(1, Math.ceil((resource.data?.totalCount || 0) / PAGE_SIZE));
  return (
    <>
      {announcementId != null && (
        <div className="announcement-detail-toolbar">
          <nav
            className="workspace-breadcrumb announcement-breadcrumb"
            aria-label="현재 위치"
          >
            <button onClick={() => navigate(`${base}${query}`)}>
              공지사항
            </button>
            <span aria-hidden="true">/</span>
            <span aria-current="page">
              {!accessError && resource.data?.title
                ? resource.data.title
                : resource.loading
                  ? "불러오는 중…"
                  : "공지 상세"}
            </span>
          </nav>
        </div>
      )}
      <section
        className={`stack announcements-page${announcementId == null ? " is-list" : ""}`}
      >
        <div className="page-heading">
          <div className="announcement-title-group">
            <h1>
              {announcementId == null
                ? "공지사항"
                : !accessError && resource.data?.title
                  ? resource.data.title
                  : resource.loading
                    ? "공지를 불러오는 중…"
                    : "공지사항"}
            </h1>
            {announcementId != null &&
              !accessError &&
              resource.data?.pinned && (
                <span className="announcement-pin">중요</span>
              )}
          </div>
          <div className="heading-actions">
            {announcementId != null && (
              <button
                className="secondary-button announcement-back-button"
                onClick={() => navigate(`${base}${query}`)}
              >
                ← 목록으로
              </button>
            )}
            <RefreshButton
              disabled={resource.loading || busy}
              onClick={() => {
                setError(null);
                resource.reload();
              }}
            />
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
                <div className="announcement-search-toolbar">
                  <div className="announcement-search-status">
                    {resource.data && <span className="announcement-total-count" role="status">전체 공지 {resource.data.totalCount.toLocaleString()}건</span>}
                    {search && <button className="text-button" onClick={() => {
                      navigate(`${base}${announcementQuery(page)}`);
                      searchField.current?.focus();
                    }}>검색 초기화 <Icon name="close" /></button>}
                  </div>
                  <form role="search" aria-label="공지 검색" onSubmit={(event) => {
                    event.preventDefault();
                    navigate(`${base}${announcementQuery(page, searchInput)}`);
                  }}>
                    <label className="sr-only" htmlFor="announcement-search">현재 페이지 공지 검색</label>
                    <div className="announcement-search-input">
                      <Icon name="search" />
                      <input id="announcement-search" ref={searchField} type="search" maxLength={100}
                        placeholder="현재 페이지의 제목·작성자 검색" value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)} />
                    </div>
                    <button className="secondary-button" type="submit">검색</button>
                  </form>
                </div>
                {visibleItems.length ? (
                  <AnnouncementList
                    items={visibleItems}
                    onDownload={downloadAttachment}
                    downloadingId={downloadingId}
                    onOpen={(id) =>
                      navigate(`${announcementPath(space.id, id)}${query}`)
                    }
                  />
                ) : (
                  <p className="announcement-empty">
                    <Icon name="announcement" />
                    {search && resource.data.items.length ? "현재 페이지에서 일치하는 공지가 없습니다." : "등록된 공지사항이 없습니다."}
                  </p>
                )}
                <nav className="announcement-pagination" aria-label="공지 목록 페이지">
                  <button
                    className="secondary-button"
                    disabled={page === 0 || resource.loading}
                    onClick={() => navigate(`${base}${announcementQuery(page - 1, search)}`)}
                  >이전</button>
                  <span>{page + 1}페이지</span>
                  <button
                    className="secondary-button"
                    disabled={resource.loading || page + 1 >= totalPages}
                    onClick={() => navigate(`${base}${announcementQuery(page + 1, search)}`)}
                  >다음</button>
                </nav>
              </>
            ) : (
              <article className="announcement-detail">
                <header className="announcement-detail-heading">
                  <div className="announcement-metadata">
                    <div><span>작성자</span><strong>{resource.data.authorName}</strong></div>
                    <div><span>등록일</span><time dateTime={resource.data.createdAt}>
                      {formatDate(resource.data.createdAt)}
                    </time></div>
                    {resource.data.updatedAt !== resource.data.createdAt && (
                      <div><span>수정일</span><time dateTime={resource.data.updatedAt}>
                        {formatDate(resource.data.updatedAt)}
                      </time></div>
                    )}
                  </div>
                </header>
                <p className="announcement-content">{resource.data.content}</p>
                {!!resource.data.attachments?.length && (
                  <div className="announcement-detail-attachments">
                    <h2>첨부파일</h2>
                    <ul className="announcement-attachment-list">
                      {resource.data.attachments.map((attachment) => {
                        return <li key={attachment.id}>
                          <button
                            type="button"
                            className="text-button announcement-attachment-download"
                            disabled={downloadingId === String(resource.data.id)}
                            onClick={() => downloadAttachment(resource.data, attachment)}
                          ><Icon name="download" /> <span>{attachment.originalFilename}</span></button>
                        </li>;
                      })}
                    </ul>
                  </div>
                )}
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

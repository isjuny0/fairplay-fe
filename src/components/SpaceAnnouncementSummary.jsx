import { useState } from "react";
import { listSpaceAnnouncements } from "../api/spaceAnnouncements.js";
import { downloadAnnouncementAttachments } from '../lib/announcementDownloads.js';
import useResource from "../hooks/useResource.js";
import useAppNavigate from "../hooks/useAppNavigate.js";
import { announcementPath, announcementsPath } from "../lib/routes.js";
import AnnouncementList from "./AnnouncementList.jsx";
import { ErrorNotice } from "./ui.jsx";
import "../space-announcements.css";

export default function SpaceAnnouncementSummary({ space }) {
  const resource = useResource(
    () => listSpaceAnnouncements(space.id, 0, 3),
    [space.id],
  );
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const navigate = useAppNavigate();
  const downloadAttachment = async (item, attachments) => {
    const key = String(item.id);
    setDownloadingId(key);
    setError(null);
    try {
      await downloadAnnouncementAttachments(space.id, item, attachments);
    } catch (downloadError) {
      setError(downloadError);
    } finally {
      setDownloadingId(null);
    }
  };
  return (
    <section
      className="space-announcement-summary"
      aria-labelledby="space-announcement-heading"
    >
      <div className="announcement-section-heading">
        <h2 id="space-announcement-heading">
          <button type="button" className="announcement-heading-link"
            onClick={() => navigate(announcementsPath(space.id))}>
            공지사항
          </button>
        </h2>
        <div className="heading-actions">
          <button
            className="text-button"
            onClick={() => navigate(announcementsPath(space.id))}
          >
            전체 보기
          </button>
        </div>
      </div>
      <ErrorNotice error={error || resource.error} onRetry={() => {
        setError(null);
        resource.reload();
      }} />
      {!resource.error &&
        (resource.data ? (
          resource.data.items.length ? (
            <AnnouncementList
              compact
              items={resource.data.items}
              onDownload={downloadAttachment}
              downloadingId={downloadingId}
              onOpen={(id) => navigate(announcementPath(space.id, id))}
            />
          ) : (
            <p className="announcement-empty">등록된 공지사항이 없습니다.</p>
          )
        ) : (
          <p role="status" className="field-help">
            공지사항을 불러오는 중…
          </p>
        ))}
    </section>
  );
}

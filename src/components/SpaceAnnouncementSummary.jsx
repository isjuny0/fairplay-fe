import { useState } from "react";
import { listSpaceAnnouncements } from "../api/spaceAnnouncements.js";
import useResource from "../hooks/useResource.js";
import useAppNavigate from "../hooks/useAppNavigate.js";
import { useInteractions } from "../hooks/useInteractions.js";
import { announcementPath, announcementsPath } from "../lib/routes.js";
import AnnouncementList from "./AnnouncementList.jsx";
import AnnouncementEditor from "./AnnouncementEditor.jsx";
import { ErrorNotice } from "./ui.jsx";
import "../space-announcements.css";

export default function SpaceAnnouncementSummary({ space }) {
  const resource = useResource(
    () => listSpaceAnnouncements(space.id, 0, 3),
    [space.id],
  );
  const [creating, setCreating] = useState(false);
  const navigate = useAppNavigate();
  const { notify } = useInteractions();
  return (
    <section
      className="space-announcement-summary"
      aria-labelledby="space-announcement-heading"
    >
      <div className="announcement-section-heading">
        <h2 id="space-announcement-heading">공지사항</h2>
        <div className="heading-actions">
          <button
            className="text-button"
            onClick={() => navigate(announcementsPath(space.id))}
          >
            전체 보기
          </button>
          {space.myRole === "MANAGER" && (
            <button
              className="secondary-button"
              onClick={() => setCreating(true)}
            >
              공지 작성
            </button>
          )}
        </div>
      </div>
      <ErrorNotice error={resource.error} onRetry={resource.reload} />
      {!resource.error &&
        (resource.data ? (
          resource.data.length ? (
            <AnnouncementList
              compact
              items={resource.data}
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
      {creating && (
        <AnnouncementEditor
          spaceId={space.id}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            notify("공지사항을 등록했습니다.");
            navigate(announcementPath(space.id, saved.id));
          }}
        />
      )}
    </section>
  );
}

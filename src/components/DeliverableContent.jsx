import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { categoryLabels, formatDate, memberName } from "../lib/domain.js";
import { isPreviewPath } from "../lib/previewPath.js";
import Icon from "./Icon.jsx";
import MarkdownBody from "./MarkdownBody.jsx";

function DocumentPreview({ children }) {
  const content = useRef(null);
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const documentBody = content.current.firstElementChild;
    const observer = new ResizeObserver(() => {
      setHasMore(documentBody.getBoundingClientRect().height > 360);
    });
    observer.observe(documentBody);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="deliverable-document-preview">
      <div
        id={contentId}
        ref={content}
        className={expanded ? "" : "deliverable-document-excerpt"}
        onFocusCapture={() => setExpanded(true)}
      >
        <MarkdownBody>{children}</MarkdownBody>
      </div>
      {hasMore && (
        <button
          className="ghost-button deliverable-expand"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "본문 접기" : "본문 더 보기"}
        </button>
      )}
    </div>
  );
}

export default function DeliverableContent({
  deliverable,
  task,
  members,
  previewDocument = false,
  onDownload,
}) {
  const { spaceId, teamId } = useParams();
  const { pathname } = useLocation();
  const prefix = isPreviewPath(pathname) ? "/preview" : "";
  return (
    <div className="deliverable-content">
      <header className="deliverable-content-header">
        <div className="deliverable-title">
          <span className="deliverable-file-mark" aria-hidden="true">
            <Icon name="file" />
          </span>
          <h3>{deliverable.title}</h3>
        </div>
        <span className="deliverable-kind">
          {deliverable.type === "FILE" ? "파일" : "문서"} ·{" "}
          {categoryLabels[deliverable.category] || deliverable.category}
        </span>
      </header>
      <div className="deliverable-context">
        {deliverable.taskId == null ? (
          <span>팀 공용 자료</span>
        ) : (
          <>
            <span>연결 작업</span>
            <Link
              to={`${prefix}/spaces/${spaceId}/teams/${teamId}/tasks/${deliverable.taskId}`}
            >
              {task?.title || `작업 #${deliverable.taskId}`}
            </Link>
          </>
        )}
      </div>
      {deliverable.description && (
        <p className="deliverable-description">{deliverable.description}</p>
      )}
      {deliverable.type === "TEXT" ? (
        <section className="deliverable-document" aria-label="산출물 본문">
          {previewDocument ? (
            <DocumentPreview key={deliverable.id}>
              {deliverable.text}
            </DocumentPreview>
          ) : (
            <MarkdownBody>{deliverable.text}</MarkdownBody>
          )}
        </section>
      ) : (
        <div className="deliverable-file-row">
          <Icon name="file" />
          <div className="deliverable-file-info">
            <span>{deliverable.file.originalFilename}</span>
            <small>{(deliverable.file.sizeBytes / 1024).toFixed(1)} KiB</small>
          </div>
          <button
            className="secondary-button"
            onClick={() => onDownload(deliverable)}
          >
            <Icon name="download" />
            파일 다운로드
          </button>
        </div>
      )}
      <footer className="deliverable-content-footer">
        <span>등록자 {memberName(members, deliverable.authorId)}</span>
        <span>
          수정{" "}
          <time dateTime={deliverable.updatedAt}>
            {formatDate(deliverable.updatedAt)}
          </time>
        </span>
        <details className="deliverable-record">
          <summary>등록·수정 정보</summary>
          <dl>
            <div>
              <dt>등록일</dt>
              <dd>{formatDate(deliverable.createdAt)}</dd>
            </div>
            <div>
              <dt>최종 수정일</dt>
              <dd>{formatDate(deliverable.updatedAt)}</dd>
            </div>
          </dl>
        </details>
      </footer>
    </div>
  );
}

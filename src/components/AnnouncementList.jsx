import { formatDate } from "../lib/domain.js";
import Icon from "./Icon.jsx";

export default function AnnouncementList({ items, onOpen, onDownload, downloadingId, compact = false }) {
  return (
    <div className={`announcement-board${compact ? " is-compact" : ""}`}>
      {!compact && (
        <div className="announcement-columns" aria-hidden="true">
          <span>구분</span><span>제목</span><span>작성자</span><span>등록일</span>
        </div>
      )}
      <ul className={`announcement-list${compact ? " is-compact" : ""}`} aria-label="스페이스 공지 목록">
      {items.map((item) => (
        <li className={`announcement-row${item.pinned ? " is-pinned" : ""}`} key={item.id}>
          <div className="announcement-kind">
            {item.pinned ? <span role="img" aria-label="중요 공지"><Icon name="announcement" /></span> : <span>공지</span>}
          </div>
          <div className="announcement-row-copy">
            <div className="announcement-title-line">
              <button
                className="text-button announcement-title"
                title={item.title}
                onClick={() => onOpen(item.id)}
              >
                {item.title}
              </button>
              {!!item.attachments?.length && (
                <button
                  type="button"
                  className="ghost-button announcement-attachment-download"
                  title={item.attachments.map((attachment) => attachment.originalFilename).join('\n')}
                  aria-label={item.attachments.length === 1
                    ? `${item.attachments[0].originalFilename} 다운로드`
                    : `첨부파일 ${item.attachments.length}개를 ZIP으로 모두 다운로드: ${item.attachments.map((attachment) => attachment.originalFilename).join(', ')}`}
                  disabled={!onDownload || downloadingId === String(item.id)}
                  onClick={() => onDownload?.(item, item.attachments)}
                >
                  <Icon name="download" />
                </button>
              )}
            </div>
          </div>
          <span className="announcement-author"><span className="sr-only">작성자 </span>{item.authorName}</span>
          <time dateTime={item.createdAt}>
            <span className="sr-only">등록일 </span>{formatDate(item.createdAt)}
          </time>
        </li>
      ))}
      </ul>
    </div>
  );
}

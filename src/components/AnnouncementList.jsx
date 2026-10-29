import { formatDate } from "../lib/domain.js";
import Icon from "./Icon.jsx";

export default function AnnouncementList({ items, onOpen, compact = false }) {
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
            <button
              className="text-button announcement-title"
              title={item.title}
              onClick={() => onOpen(item.id)}
            >
              {item.title}
            </button>
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

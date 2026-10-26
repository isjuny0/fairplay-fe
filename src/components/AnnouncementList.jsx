export default function AnnouncementList({ items, onOpen, compact = false }) {
  return (
    <ul className={`announcement-list${compact ? " is-compact" : ""}`}>
      {items.map((item) => (
        <li className="announcement-row" key={item.id}>
          <div className="announcement-row-title">
            {item.pinned && <span className="announcement-pin">고정</span>}
            <button
              className="text-button announcement-title"
              onClick={() => onOpen(item.id)}
            >
              {item.title}
            </button>
          </div>
          {!compact && (
            <span className="announcement-author">{item.authorName}</span>
          )}
          <time dateTime={item.createdAt}>
            {item.createdAt.slice(0, 10).replaceAll("-", ".")}
          </time>
        </li>
      ))}
    </ul>
  );
}

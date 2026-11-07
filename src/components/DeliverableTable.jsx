import Icon from "./Icon.jsx";
import useMobileLayout from '../hooks/useMobileLayout.js';
import {
  deliverablePermissions,
  formatDate,
  memberName,
} from "../lib/domain.js";

export default function DeliverableTable({
  deliverables,
  taskMap,
  team,
  user,
  members,
  busy,
  onOpen,
  onDownload,
  onEdit,
  onRemove,
}) {
  const mobile = useMobileLayout('(max-width: 720px)');
  if (mobile) return <MobileDeliverableList {...{ deliverables, taskMap, team, user, members, busy, onOpen, onDownload, onEdit, onRemove }} />;
  return (
    <div
      className="table-scroll collection-table-scroll deliverable-table-scroll"
      role="region"
      aria-label="팀 자료 목록"
      tabIndex={0}
    >
      <table className="data-table collection-table deliverable-table">
        <caption className="sr-only">
          현재 페이지 자료: 이름, 유형, 연결 작업, 등록자, 최종 수정일,
          관리
        </caption>
        <thead>
          <tr>
            <th scope="col">자료명</th>
            <th scope="col">유형</th>
            <th scope="col">연결 작업</th>
            <th scope="col">등록자</th>
            <th scope="col">최종 수정일</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {deliverables.map((deliverable) => {
            const permissions = deliverablePermissions(
              deliverable,
              taskMap.get(deliverable.taskId),
              team,
              user.id,
            );
            return (
              <tr className="deliverable-card" key={deliverable.id}>
                <th scope="row" className="collection-name-cell">
                  <div className="collection-title-actions">
                  <h3>
                    <button
                      className="collection-title-button"
                      onClick={() => onOpen(deliverable.id)}
                    >
                      <span
                        className="deliverable-file-mark"
                        aria-hidden="true"
                      >
                        <Icon name="file" />
                      </span>
                      <span>{deliverable.title}</span>
                    </button>
                  </h3>
                  {deliverable.type === 'FILE' && <button className="ghost-button deliverable-mobile-download" aria-label={`${deliverable.title} 파일 다운로드`} title="파일 다운로드" disabled={busy} onClick={() => onDownload(deliverable)}><Icon name="download" /></button>}
                  </div>
                  {deliverable.file && (
                    <small
                      className="collection-filename"
                      title={deliverable.file.originalFilename}
                    >
                      {deliverable.file.originalFilename}
                    </small>
                  )}
                </th>
                <td>
                  <span className="collection-type">
                    {deliverable.type === "FILE" ? "파일" : "문서"}
                  </span>
                </td>
                <td className="collection-task-cell">
                  <span
                    className={
                      deliverable.taskId == null
                        ? "deliverable-common-label"
                        : ""
                    }
                    title={taskMap.get(deliverable.taskId)?.title}
                  >
                    {deliverable.taskId == null
                      ? "팀 공용"
                      : taskMap.get(deliverable.taskId)?.title ||
                        "작업 정보 확인 불가"}
                  </span>
                </td>
                <td>{memberName(members, deliverable.authorId)}</td>
                <td>
                  <time dateTime={deliverable.updatedAt}>
                    {formatDate(deliverable.updatedAt)}
                  </time>
                </td>
                <td>
                  <div className="collection-actions">
                    {deliverable.type === "FILE" && (
                      <button
                        className="ghost-button deliverable-download"
                        aria-label="파일 다운로드"
                        title="파일 다운로드"
                        onClick={() => onDownload(deliverable)}
                      >
                        <Icon name="download" />
                      </button>
                    )}
                    {permissions.metadata && (
                      <button
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => {
                          onEdit(deliverable);
                        }}
                      >
                        수정
                      </button>
                    )}
                    {permissions.remove && (
                      <button
                        className="ghost-button danger"
                        disabled={busy}
                        onClick={() => onRemove(deliverable)}
                      >
                        삭제
                      </button>
                    )}
                    {!permissions.metadata &&
                      !permissions.remove &&
                      deliverable.type !== "FILE" && (
                        <span className="field-help">조회만 가능</span>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileDeliverableList({ deliverables, taskMap, team, user, members, busy, onOpen, onDownload, onEdit, onRemove }) {
  return <div className="mobile-list-region" role="region" aria-label="팀 자료 목록">
    <ul className="mobile-record-list mobile-material-list">
      {deliverables.map(deliverable => {
        const permissions = deliverablePermissions(deliverable, taskMap.get(deliverable.taskId), team, user.id);
        const canManage = permissions.metadata || permissions.remove;
        return <li key={deliverable.id} className="mobile-record">
          <div className="mobile-record-heading">
            <button type="button" className="collection-title-button" onClick={() => onOpen(deliverable.id)}>{deliverable.title}</button>
            <span className="mobile-record-type">{deliverable.type === 'FILE' ? '파일' : '문서'}</span>
            {deliverable.type === 'FILE' && <button type="button" className="ghost-button mobile-record-download" aria-label={`${deliverable.title} 파일 다운로드`} title="파일 다운로드" disabled={busy} onClick={() => onDownload(deliverable)}><Icon name="download" /></button>}
          </div>
          <dl className="mobile-record-meta">
            <div><dt>등록자</dt><dd>{memberName(members, deliverable.authorId)}</dd></div>
            <div><dt>수정일</dt><dd><time dateTime={deliverable.updatedAt}>{formatDate(deliverable.updatedAt)}</time></dd></div>
            <div><dt>연결 작업</dt><dd>{deliverable.taskId == null ? '팀 공용' : taskMap.get(deliverable.taskId)?.title || '작업 정보 확인 불가'}</dd></div>
            {deliverable.file && <div><dt>파일명</dt><dd>{deliverable.file.originalFilename}</dd></div>}
          </dl>
          {canManage ? (
            <div className="mobile-record-actions">
              {permissions.metadata && <button type="button" className="ghost-button" disabled={busy} onClick={() => onEdit(deliverable)}>수정</button>}
              {permissions.remove && <button type="button" className="ghost-button danger" disabled={busy} onClick={() => onRemove(deliverable)}>삭제</button>}
            </div>
          ) : deliverable.type !== 'FILE' && <span className="field-help">조회만 가능</span>}
        </li>;
      })}
    </ul>
  </div>;
}

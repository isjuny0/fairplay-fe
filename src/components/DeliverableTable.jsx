import Icon from "./Icon.jsx";
import {
  categoryLabels,
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
  return (
    <div
      className="table-scroll collection-table-scroll"
      role="region"
      aria-label="산출물 목록"
      tabIndex={0}
    >
      <table className="data-table collection-table deliverable-table">
        <caption className="sr-only">
          현재 페이지 산출물: 이름, 유형·분류, 연결 작업, 등록자, 최종 수정일,
          관리
        </caption>
        <thead>
          <tr>
            <th scope="col">산출물명</th>
            <th scope="col">유형·분류</th>
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
                  <small>
                    {categoryLabels[deliverable.category] ||
                      {
                        RESEARCH: "조사·분석",
                        PRESENTATION: "발표",
                        OPERATION: "행사·운영",
                      }[deliverable.category] ||
                      deliverable.category}
                  </small>
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
                        `작업 #${deliverable.taskId}`}
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

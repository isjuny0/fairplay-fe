import { apiTimeToEpoch } from '../lib/koreanTime.js';
// 예시 화면에서도 서버와 같이 조건 적용 후 페이지를 나눈다.
export function searchPreviewDeliverables(deliverables, params) {
  const query = (params.get("q") || "").trim().toLocaleLowerCase();
  const taskId = Number(params.get("taskId"));
  const type = params.get("type");
  const category = params.get("category");
  const authorId = params.get("authorId");
  const unlinkedOnly = params.get("unlinkedOnly") === "true";
  const sort = params.get("sort") || "CREATED_DESC";
  const size = Number(params.get("size") || 20);
  const page = Number(params.get("page") || 0);
  return deliverables
    .filter(
      (item) =>
        (!taskId || item.taskId === taskId) &&
        (!unlinkedOnly || item.taskId == null) &&
        (!type || item.type === type) &&
        (!category || item.category === category) &&
        (!authorId || item.authorId === authorId) &&
        (!query ||
          item.title.toLocaleLowerCase().includes(query) ||
          item.file?.originalFilename.toLocaleLowerCase().includes(query)),
    )
    .sort((left, right) => {
      const primary =
        sort === "TITLE_ASC"
          ? left.title.localeCompare(right.title)
          : apiTimeToEpoch(
              right[sort === "UPDATED_DESC" ? "updatedAt" : "createdAt"],
            ) -
            apiTimeToEpoch(
              left[sort === "UPDATED_DESC" ? "updatedAt" : "createdAt"],
            );
      return primary || right.id - left.id;
    })
    .slice(page * size, (page + 1) * size);
}

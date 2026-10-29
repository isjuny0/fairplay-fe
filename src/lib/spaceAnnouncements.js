export const announcementLimits = { title: 100, content: 5000 };

export function validateAnnouncement(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const content =
    typeof input?.content === "string" ? input.content.trim() : "";
  if (!title || title.length > announcementLimits.title)
    return {
      field: "title",
      message: "제목은 공백을 제외하고 1~100자로 작성해 주세요.",
    };
  if (!content || content.length > announcementLimits.content)
    return {
      field: "content",
      message: "본문은 공백을 제외하고 1~5,000자로 작성해 주세요.",
    };
  return null;
}

export const isAnnouncementConflict = (error) =>
  error?.status === 409 && error.code === "ANNOUNCEMENT_VERSION_CONFLICT";

export function announcementPage(search) {
  const value = new URLSearchParams(search).get("page") || "0";
  const page = Number(value);
  return /^\d+$/.test(value) &&
    Number.isInteger(page) &&
    page >= 0 &&
    page < 2147483647
    ? page
    : 0;
}

export function announcementSearch(search) {
  return (new URLSearchParams(search).get("q") || "").trim().slice(0, 100);
}

export function announcementQuery(page, search = "") {
  const params = new URLSearchParams();
  if (page > 0) params.set("page", String(page));
  if (search.trim()) params.set("q", search.trim().slice(0, 100));
  return params.size ? `?${params}` : "";
}

// The collection API only provides a page, not a server-wide search endpoint.
export function filterAnnouncements(items, search) {
  const query = search.trim().normalize("NFC").toLocaleLowerCase("ko-KR");
  return query ? items.filter((item) =>
    [item.title, item.authorName].some((value) =>
      (value || "").normalize("NFC").toLocaleLowerCase("ko-KR").includes(query),
    ),
  ) : items;
}

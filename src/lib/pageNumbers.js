export function pageNumbers(currentPage, totalPages, maxVisible = 10) {
  if (!Number.isInteger(currentPage) || !Number.isInteger(totalPages) || totalPages < 1) return [];
  const selectedPage = Math.min(Math.max(1, currentPage), totalPages);
  const visibleCount = Math.min(Math.max(1, maxVisible), totalPages);
  const firstPage = Math.max(
    1,
    Math.min(selectedPage - Math.floor(visibleCount / 2), totalPages - visibleCount + 1),
  );
  return Array.from({ length: visibleCount }, (_, index) => firstPage + index);
}

// These query values select the content containing a guide target. Other values
// (for example, a task detail's board return view) need not interrupt guidance.
const selectionKeys = ['tab', 'teamId', 'taskId', 'roundId', 'peerRoundId', 'status', 'teamQuery', 'teamFilter', 'teamSort'];

export function isReportGuideDrawer(dialog, step) {
  return Boolean(step.id.startsWith('management-report-') && dialog?.classList.contains('report-detail-drawer'));
}

export function guideLocationMatches(step, location) {
  const destination = new URL(step.path, 'https://preview.invalid');
  if (location.pathname !== destination.pathname) return false;
  const actual = new URLSearchParams(location.search);
  const keys = new Set([...selectionKeys, ...destination.searchParams.keys()]);
  if (destination.pathname.endsWith('/tasks')) {
    // Task list filters can hide the example task altogether.
    for (const key of actual.keys()) keys.add(key);
  }
  return [...keys].every((key) => actual.getAll(key).join('\0') === destination.searchParams.getAll(key).join('\0'));
}

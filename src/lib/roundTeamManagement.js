export const ROUND_TEAM_PAGE_SIZE = 10;

const searchText = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
const byName = (a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }) || String(a.teamId).localeCompare(String(b.teamId), 'ko', { numeric: true });

export function getRoundTeamView(teams, { query = '', status = 'all', sort = 'missing', page = 1 } = {}) {
  const needle = searchText(query);
  const filtered = teams.filter((team) =>
    searchText(team.name).includes(needle)
    && (status === 'missing' ? team.missingCount > 0
      : status === 'submitted' ? team.requiredCount > 0 && team.missingCount === 0 : true));
  const ordered = [...filtered].sort(sort === 'name' ? byName : sort === 'progress'
    ? (a, b) => (a.requiredCount > 0 ? a.submittedCount / a.requiredCount : 2)
      - (b.requiredCount > 0 ? b.submittedCount / b.requiredCount : 2) || byName(a, b)
    : (a, b) => b.missingCount - a.missingCount || byName(a, b));
  const pageCount = Math.max(1, Math.ceil(ordered.length / ROUND_TEAM_PAGE_SIZE));
  const currentPage = Math.min(pageCount, Math.max(1, Number.isSafeInteger(Number(page)) ? Number(page) : 1));
  return {
    teams: ordered.slice((currentPage - 1) * ROUND_TEAM_PAGE_SIZE, currentPage * ROUND_TEAM_PAGE_SIZE),
    count: ordered.length,
    page: currentPage,
    pageCount,
    summary: {
      total: teams.length,
      complete: teams.filter((team) => team.requiredCount > 0 && team.missingCount === 0).length,
      pending: teams.filter((team) => team.missingCount > 0).length,
      missing: teams.reduce((count, team) => count + team.missingCount, 0),
    },
  };
}

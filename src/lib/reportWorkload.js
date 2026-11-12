const percent = (value, max = 100) => Number.isFinite(value) && value >= 0 && value <= max;

export function validReportWorkload(summary, memberCount) {
  if (!summary || !Number.isInteger(memberCount) || memberCount < 2
    || !percent(summary.equalSharePercent) || summary.equalSharePercent === 0
    || !Array.isArray(summary.members) || summary.members.length !== memberCount) return false;
  const unavailable = summary.formerMemberCompletedWorkSharePercent === null;
  return (unavailable || percent(summary.formerMemberCompletedWorkSharePercent))
    && new Set(summary.members.map((member) => member?.userId)).size === memberCount
    && summary.members.every((member) => typeof member?.userId === 'string' && typeof member.name === 'string'
      && (unavailable
        ? member.completedWorkSharePercent === null && member.relativeToTeamAveragePercent === null
        : percent(member.completedWorkSharePercent) && percent(member.relativeToTeamAveragePercent, memberCount * 100)));
}

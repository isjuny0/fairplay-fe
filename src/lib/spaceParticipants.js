export function participantRemovalHint(member, currentUserId) {
  if (member.role !== "USER" || member.userId === currentUserId)
    return "스페이스 관리자와 본인은 삭제할 수 없습니다.";
  if (member.team?.role === "LEADER") return "팀 리더는 삭제할 수 없습니다.";
  if (member.canRemove !== true)
    return "구성 잠금 또는 업무 의존성 등으로 삭제할 수 없습니다.";
  return "";
}

export const MAX_ESTIMATED_MINUTES = 2_147_483_640;

export function validEstimatedMinutes(minutes) {
  return Number.isInteger(minutes) && minutes >= 30 &&
    minutes <= MAX_ESTIMATED_MINUTES && minutes % 30 === 0;
}

export function taskEstimatedMinutes(task) {
  // 이전 응답과 미리보기 저장값도 서버의 weight × 30 환산 규칙을 따른다.
  return task?.estimatedMinutes ?? (task?.weight == null ? null : task.weight * 30);
}

export function formatEstimatedTime(minutes) {
  if (!validEstimatedMinutes(minutes)) return '예상 시간 확인 필요';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return [hours && `${hours}시간`, remainder && `${remainder}분`].filter(Boolean).join(' ');
}

export const formatTaskEstimatedTime = (task) => formatEstimatedTime(taskEstimatedMinutes(task));

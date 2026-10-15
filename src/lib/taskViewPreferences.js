const storageKey = 'fairplay:task-view-preferences';
const defaults = { view: 'board', labelWidth: 300 };

export function readTaskViewPreferences() {
  try {
    const saved = JSON.parse(globalThis.localStorage.getItem(storageKey));
    return {
      view: ['board', 'list', 'calendar', 'timeline'].includes(saved?.view)
        ? saved.view
        : defaults.view,
      labelWidth: Number.isInteger(saved?.labelWidth) &&
        saved.labelWidth >= 220 && saved.labelWidth <= 520
        ? saved.labelWidth
        : defaults.labelWidth,
    };
  } catch {
    // 저장소가 차단되거나 설정이 손상되어도 작업 화면은 기본값으로 연다.
    return { ...defaults };
  }
}

export function saveTaskViewPreferences(preferences) {
  try {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // 브라우저 설정 저장 실패가 작업 조회·수정을 막지 않도록 한다.
  }
}

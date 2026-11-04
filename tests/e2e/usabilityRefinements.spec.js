import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

test('스페이스를 방문한 뒤 내 스페이스 목록으로 돌아갈 수 있다', async ({ page }) => {
  await page.goto('/preview/spaces/1');
  await expect(page.locator('.space-home').getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: '내 스페이스', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '스페이스 이름 검색' })).toBeVisible();
});

for (const width of [320, 390, 1440]) {
  test(`${width}px: 팀 홈 설정은 별도로 열고 위젯 추가 후 원래 버튼으로 돌아간다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    const settings = page.getByRole('button', { name: '화면 설정', exact: true });
    await expect(settings).toBeVisible();
    await expect(page.getByRole('button', { name: '위젯 추가', exact: true })).toBeHidden();
    await settings.click();
    await page.getByRole('button', { name: '위젯 추가', exact: true }).click();
    await page.getByRole('dialog', { name: '위젯 추가', exact: true }).getByRole('button', { name: '완료', exact: true }).click();
    await expect(settings).toBeFocused();
    await settings.click();
    await page.getByRole('button', { name: '위젯 편집', exact: true }).click();
    const done = page.getByRole('button', { name: '편집 완료', exact: true });
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
    await expect(page.locator('.dashboard-edit-hint')).toBeVisible();
    await done.press('Space');
    await expect(page.locator('.dashboard-edit-hint')).toHaveCount(0);
    await expect(settings).toBeFocused();
  });
}

for (const width of [320, 390]) {
  test(`${width}px: 평가 하단 바는 입력 공간을 확보하고 최종 제출은 본문에 둔다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/preview/spaces/1/teams/1/peer-evaluations');
    const dock = page.getByRole('region', { name: '평가 저장 및 제출', exact: true });
    await expect(dock).toBeVisible();
    expect((await dock.boundingBox()).height).toBeLessThan(90);
    await expect(dock.getByRole('button', { name: '최종 제출', exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '평가 최종 제출', exact: true }).getByRole('button', { name: '최종 제출', exact: true })).toBeDisabled();
  });

  test(`${width}px: 회의 제목·일시는 가로 이동 없이 보이고 산출물은 바로 다운로드한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/meeting-minutes');
    const table = page.getByRole('region', { name: '회의록 목록', exact: true });
    const date = table.locator('tbody td').first();
    await expect(date).toBeVisible();
    const region = await table.boundingBox();
    const cell = await date.boundingBox();
    expect(cell.x + cell.width).toBeLessThanOrEqual(region.x + region.width + 1);
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    const download = page.getByRole('button', { name: '팀 권한 점검표 파일 파일 다운로드', exact: true });
    await expect(download).toBeInViewport();
    const ready = page.waitForEvent('download');
    await download.click();
    expect((await ready).suggestedFilename()).toBe('팀-권한-점검표.txt');
  });
}

test('작업 빠른 필터와 다음 행동이 실제 작업·입력 영역으로 연결된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/preview/spaces/1/teams/1/tasks');
  const quick = page.getByRole('group', { name: '빠른 작업 필터', exact: true });
  await quick.getByRole('button', { name: '내 담당', exact: true }).click();
  await expect(page).toHaveURL(/mine=1/);
  await quick.getByRole('button', { name: '마감 지남', exact: true }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await page.goto('/preview/spaces/1/teams/1/tasks/102');
  const summary = page.locator('[aria-label="완료 준비 요약"]');
  await expect(summary).toContainText('다음 할 일');
  await summary.getByRole('button').click();
  await expect(page.locator('#task-assignment-section')).toBeFocused();
});

test('공지 작성의 추가 도구를 펼쳐도 본문과 마크다운 미리보기를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'manager'));
  await page.goto('/preview/spaces/1/announcements');
  await page.getByRole('button', { name: '공지 작성', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '공지 작성', exact: true });
  const body = dialog.getByLabel('공지 본문', { exact: true });
  await body.fill('## 작성한 안내');
  await expect(dialog.getByRole('button', { name: '표 서식 삽입', exact: true })).toBeHidden();
  await dialog.getByRole('button', { name: '더보기', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '표 서식 삽입', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '작성한 안내', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '작성', exact: true }).click();
  await expect(body).toHaveValue('## 작성한 안내');
});

test('알림은 날짜별로 읽고 할 일은 작업·평가를 원래 마감 순서로 추릴 수 있다', async ({ page }) => {
  await page.goto('/preview/notifications');
  await expect(page.locator('.notification-date-heading').first()).toContainText('오늘');
  await page.getByRole('button', { name: '할 일', exact: true }).click();
  const popover = page.getByRole('region', { name: '할 일 미리보기', exact: true });
  await expect(popover.locator('.header-task-preview-card').first()).toBeVisible();
  await popover.getByRole('button', { name: '작업', exact: true }).click();
  for (const card of await popover.locator('.header-task-preview-card').all()) await expect(card).toHaveAttribute('data-type', 'TASK');
  await popover.getByRole('button', { name: '동료 평가', exact: true }).click();
  for (const card of await popover.locator('.header-task-preview-card').all()) await expect(card).toHaveAttribute('data-type', 'PEER_EVALUATION');
});

for (const route of ['/preview/spaces/1', '/preview/spaces/1/announcements']) {
  test(`${route}: 여러 첨부파일은 한 ZIP, 상세에서는 개별 파일로 내려받는다`, async ({ page }) => {
    await page.goto(route);
    const button = page.getByRole('button', { name: /^첨부파일 2개를 ZIP으로 모두 다운로드:/ });
    await expect(button).toHaveCount(1);
    await expect(button.locator('.announcement-attachment-count')).toHaveText('2');
    const zipReady = page.waitForEvent('download');
    await button.click();
    const zipDownload = await zipReady;
    expect(zipDownload.suggestedFilename()).toBe('팀별 진행 상황을 공유해 주세요-첨부파일.zip');
    const zip = await JSZip.loadAsync(await readFile(await zipDownload.path()));
    expect(Object.keys(zip.files)).toEqual(['팀별 진행 상황 안내.txt', '회의 준비 체크리스트.txt']);
    expect(await zip.file('팀별 진행 상황 안내.txt').async('string')).not.toBe('');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.goto('/preview/spaces/1/announcements/2');
    const fileReady = page.waitForEvent('download');
    await page.locator('.announcement-detail-attachments').getByRole('button', { name: /팀별 진행 상황 안내.txt/ }).click();
    expect((await fileReady).suggestedFilename()).toBe('팀별 진행 상황 안내.txt');
  });
}

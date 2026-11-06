import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

const team = '/preview/spaces/1/teams/1';
const taskTitle = '모바일에서도 긴 작업 제목과 마감 및 담당자 정보를 빠짐없이 확인하는 작업';
const materialTitle = '모바일에서도 자료명과 파일 정보를 빠짐없이 확인하는 긴 제목의 팀 자료';

async function seed(page, change = () => {}) {
  await page.clock.setFixedTime(new Date('2026-11-06T03:00:00Z'));
  const state = structuredClone(getMockState(previewContext()));
  const entry = state.teams[1];
  entry.tasks[1].title = taskTitle;
  entry.tasks[1].dueAt = '2026-11-03T18:00:00';
  entry.tasks[0].dueAt = '2026-11-03T18:00:00';
  entry.deliverables.find(item => item.type === 'FILE').title = materialTitle;
  change(state);
  await page.addInitScript(state => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v11:preview:1', JSON.stringify(state));
  }, state);
  return entry;
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const region = page.locator('.mobile-list-region');
  expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}

for (const width of [320, 477, 720]) {
  test(`${width}px 자료·회의록은 세로 정보로 읽고 긴 제목도 잘리지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page);
    for (const [path, selector, title] of [
      ['deliverables', '.mobile-material-list', materialTitle],
      ['meeting-minutes', '.mobile-meeting-list', null],
    ]) {
      await page.goto(`${team}/${path}`);
      const list = page.locator(selector);
      await expect(list.locator(':scope > li').first()).toBeVisible();
      await expect(page.locator('main table')).toHaveCount(0);
      const button = title ? list.getByRole('button', { name: title, exact: true }) : list.getByRole('button').first();
      await expect(button).toHaveCSS('white-space', 'normal');
      expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await noOverflow(page);
    }
  });

  test(`${width}px 작업 목록은 기존 표·날짜·배분과 가로 이동을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const entry = await seed(page);
    await page.goto(`${team}/tasks?view=list`);
    const table = page.getByRole('table', { name: '정렬된 작업 목록' });
    await expect(table.getByRole('columnheader')).toHaveText(['작업', '상태', '담당자·배분', '예상 작업량', '시작일', '마감일']);
    await expect(page.locator('.mobile-task-list')).toHaveCount(0);
    const row = table.getByRole('row').filter({ has: page.getByRole('button', { name: taskTitle, exact: true }) });
    await expect(row.locator('.status-badge')).toHaveText('진행 중');
    await expect(row.locator('.task-date-is-overdue')).toHaveCSS('color', 'rgb(180, 35, 50)');
    const done = table.getByRole('row').filter({ has: page.getByRole('button', { name: entry.tasks[0].title, exact: true }) });
    await expect(done.locator('.task-date-is-overdue')).toHaveCount(0);
    for (const assignment of entry.tasks[1].assignees) await expect(row).toContainText(`${assignment.allocationPercent}%`);
    const region = page.getByRole('region', { name: '작업 표', exact: true });
    expect(await region.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await region.evaluate(el => { el.scrollLeft = 100; });
    expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row.getByRole('button', { name: taskTitle, exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\/102(?:\?|$)/);
  });

  test(`${width}px 자료 다운로드·수정·삭제는 독립 동작하고 조회 전용 권한을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const entry = await seed(page);
    const calls = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) calls.push(request.url()); });
    await page.goto(`${team}/deliverables`);
    const file = entry.deliverables.find(item => item.type === 'FILE');
    const row = page.locator('.mobile-material-list > li').filter({ has: page.getByRole('button', { name: materialTitle, exact: true }) });
    await expect(row.locator('details')).not.toHaveAttribute('open');
    const download = page.waitForEvent('download');
    await row.getByRole('button', { name: `${materialTitle} 파일 다운로드`, exact: true }).click();
    expect((await download).suggestedFilename()).toBe(file.file.originalFilename);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await row.locator('summary').click();
    await expect(row.locator('details')).toContainText(file.file.originalFilename);
    await noOverflow(page);
    const readOnly = page.locator('.mobile-material-list > li').filter({ has: page.getByRole('button', { name: '스페이스·팀 권한 정리', exact: true }) });
    await readOnly.locator('summary').click();
    await expect(readOnly).toContainText('조회만 가능');
    await expect(readOnly.getByRole('button', { name: /^(수정|삭제)$/ })).toHaveCount(0);
    const editable = page.locator('.mobile-material-list > li').filter({ has: page.getByRole('button', { name: 'Fairplay 프로젝트 소개', exact: true }) });
    await editable.locator('summary').click();
    await editable.getByRole('button', { name: '수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '팀 자료 수정', exact: true });
    await dialog.getByLabel('제목', { exact: true }).fill('모바일에서 수정한 팀 자료');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    const changed = page.locator('.mobile-material-list > li').filter({ has: page.getByRole('button', { name: '모바일에서 수정한 팀 자료', exact: true }) });
    await expect(changed).toBeVisible();
    if (!(await changed.locator('details').evaluate(el => el.open))) await changed.locator('summary').click();
    await changed.getByRole('button', { name: '삭제', exact: true }).click();
    const confirmation = page.getByRole('dialog').last();
    await expect(confirmation).toContainText('모바일에서 수정한 팀 자료');
    await confirmation.getByRole('button', { name: /삭제/, exact: false }).last().click();
    await expect(changed).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test(`${width}px 회의록은 제목·일시·작성자·참석자를 읽고 빈 영역에서도 상세로 이동한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page);
    await page.goto(`${team}/meeting-minutes`);
    const row = page.locator('.mobile-meeting-list > li').first();
    const title = await row.getByRole('button').innerText();
    await expect(row.locator('time')).toBeVisible();
    await expect(row.locator('.mobile-record-inline-meta')).toContainText('참석 3명');
    await expect(row.locator('[aria-label^="최초 작성자"]')).toBeVisible();
    await row.locator('time').click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.locator('.mobile-meeting-list')).toContainText(title);
    await page.reload();
    await expect(page.locator('.mobile-meeting-list')).toContainText(title);
    await noOverflow(page);
  });
}

test('모바일 작업 목록의 20건 페이지와 상세 복귀·검색 조건을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, state => {
    const original = state.teams[1].tasks[0];
    state.teams[1].tasks = Array.from({ length: 21 }, (_, index) => ({
      ...original, id: 500 + index, title: `모바일 페이지 작업 ${index}`,
      startAt: `2026-11-${String(index + 1).padStart(2, '0')}T09:00:00`,
      dueAt: '2026-12-01T18:00:00',
    }));
  });
  await page.goto(`${team}/tasks?view=list&sort=start&q=모바일`);
  await expect(page.locator('.task-table tbody tr')).toHaveCount(20);
  const pagination = page.getByRole('navigation', { name: '작업 목록 페이지' });
  await pagination.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('.task-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: '모바일 페이지 작업 20', exact: true }).click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(pagination).toContainText('2페이지');
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('모바일');
  await page.reload();
  await expect(pagination).toContainText('2페이지');
});

test('데스크톱으로 전환하면 자료·회의록은 원래 표와 열을 복원한다', async ({ page }) => {
  await seed(page);
  for (const [path, headers] of [
    ['deliverables', ['자료명', '유형', '연결 작업', '등록자', '최종 수정일', '관리']],
    ['meeting-minutes', ['회의 제목', '회의일시', '최초 작성자', '참석자']],
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${team}/${path}`);
    await expect(page.locator('.mobile-record').first()).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveText(headers);
    await expect(page.locator('.mobile-record')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.mobile-record').first()).toBeVisible();
    await noOverflow(page);
  }
});

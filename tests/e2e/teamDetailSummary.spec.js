import { test, expect } from '@playwright/test';

for (const width of [1920, 1440, 1280, 900, 721, 390, 320]) {
  test(`${width}px 팀 상세 요약은 진행률·작업·산출물을 좁은 간격으로 묶고 기존 기능을 유지한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'manager'));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/preview/spaces/1/dashboard?teamId=1');
    const overview = page.getByRole('region', { name: '선택한 팀 정보', exact: true });
    await expect(overview).toBeVisible();
    await expect(overview.locator('.dashboard-work-counts dt')).toHaveText(['할 일', '진행 중', '수정 중', '완료', '산출물']);
    await expect(overview.locator('.dashboard-work-counts dd')).toHaveText(['1건', '1건', '1건', '3건', '4개']);
    const progress = overview.getByRole('progressbar', { name: '삼위일체 팀 전체 진행률', exact: true });
    await expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect((await progress.boundingBox()).width).toBe(64);
    const box = await overview.boundingBox();
    expect(box.width).toBeLessThanOrEqual(980);
    if (width > 1000) {
      expect(box.height).toBeLessThanOrEqual(110);
      const counts = await overview.locator('.dashboard-work-counts').boundingBox();
      const indicator = await overview.locator('.dashboard-work-progress').boundingBox();
      expect(counts.x - indicator.x - indicator.width).toBeLessThanOrEqual(20);
      const metricBoxes = await overview.locator('.dashboard-work-counts > div').evaluateAll((items) => items.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; }));
      for (let index = 1; index < metricBoxes.length; index++) {
        expect(Math.abs(metricBoxes[index].width - metricBoxes[0].width)).toBeLessThan(1);
        expect(metricBoxes[index].x - metricBoxes[index - 1].x - metricBoxes[index - 1].width).toBeLessThanOrEqual(1);
      }
    } else {
      expect(box.height).toBeLessThanOrEqual(230);
    }
    const heading = await page.locator('.dashboard-page-heading').boundingBox();
    expect(box.y - heading.y - heading.height).toBeLessThanOrEqual(16);
    if (width <= 720) {
      const actions = await page.locator('.dashboard-heading-actions').boundingBox();
      expect(actions.height).toBeLessThanOrEqual(40);
      const buttons = await page.locator('.dashboard-heading-actions button').evaluateAll((items) => items.map((el) => { const r = el.getBoundingClientRect(); return r.y + r.height / 2; }));
      expect(Math.max(...buttons) - Math.min(...buttons)).toBeLessThanOrEqual(1);
    }
    const help = overview.getByRole('button', { name: '팀 진행률 집계 기준', exact: true });
    await help.focus();
    await expect(page.getByRole('tooltip')).toContainText('예상 작업량');
    await help.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const refresh = page.getByRole('button', { name: '현황 새로고침', exact: true });
    await expect(refresh).toHaveText('');
    await refresh.click();
    await expect(progress).toHaveAttribute('aria-valuenow', '50');
    await expect(page.getByRole('heading', { name: '팀원 수행 현황', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('compact-team-summary.png'), animations: 'disabled' });
    expect(await overview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('navigation', { name: '팀 조회 바로가기' }).getByRole('button')).toHaveText(['작업 보기', '산출물 보기']);
    await page.getByRole('button', { name: '← 팀 목록', exact: true }).click();
    await expect(page.getByRole('heading', { name: '팀 관리', exact: true })).toBeVisible();
    await expect(page.locator('.manager-dashboard--team')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const width of [1440, 320]) {
  test(`${width}px 작업이 없는 긴 이름의 팀은 0%로 오인하지 않고 상단 버튼과 수치를 표시한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const name = '아주 긴 이름으로도 줄바꿈을 확인하는 서비스 디자인 프로젝트 팀';
    const space = { id: 1, name: '디자인 프로젝트', myRole: 'MANAGER' };
    const team = { id: 1, spaceId: 1, name, myMembershipStatus: null };
    const summary = { teamId: 1, teamName: name, completionRate: null, todoTaskCount: 0, inProgressTaskCount: 0, revisingTaskCount: 0, doneTaskCount: 0, deliverableCount: 0, overdueTaskCount: 0, staleTaskCount: 0, pendingApplications: 0, hasMinimumMembers: true, members: [] };
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/api/')) return route.continue();
      const data = {
        '/api/me': { id: 'manager', name: '관리자' },
        '/api/me/notifications/unread-count': { unreadCount: 0 },
        '/api/spaces': [space], '/api/spaces/1': space, '/api/spaces/1/teams': [team],
        '/api/spaces/1/manager-dashboard': { spaceId: 1, teams: [summary], missingPeerSubmissions: [] },
      };
      return route.fulfill({ json: data[path] ?? [] });
    });
    await page.goto('/spaces/1/dashboard?teamId=1');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const overview = page.getByRole('region', { name: '선택한 팀 정보', exact: true });
    await expect(overview.getByText('작업 없음', { exact: true })).toBeVisible();
    await expect(overview.getByRole('progressbar')).toHaveCount(0);
    await expect(overview.locator('.dashboard-work-counts dd')).toHaveText(['0건', '0건', '0건', '0건', '0개']);
    await expect(page.getByRole('button', { name: '작업 보기', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '산출물 보기', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('empty-team-summary.png'), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

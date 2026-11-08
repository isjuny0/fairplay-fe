import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Capture the actual workspace UI with public preview fixtures, never live user data.
// Start Vite first, then run: node scripts/capture-landing-screens.mjs
const baseURL = process.env.LANDING_CAPTURE_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) {
  throw new Error('Use a local preview server; do not capture private production data.');
}
const output = fileURLToPath(new URL('../public/landing/', import.meta.url));
const screens = [
  { name: 'tasks', route: 'tasks', heading: '작업', scenario: 'active' },
  { name: 'materials', route: 'deliverables', heading: '팀 자료', scenario: 'active' },
  { name: 'report', route: 'reports', heading: '기여도 리포트', scenario: 'published' },
  { name: 'manager', path: '/preview/spaces/1/dashboard', heading: '팀 관리', scenario: 'active', role: 'manager' },
];
const requestedScreens = process.env.LANDING_CAPTURE_SCREENS?.split(',');
const selectedScreens = requestedScreens ? screens.filter((screen) => requestedScreens.includes(screen.name)) : screens;
if (!selectedScreens.length) throw new Error('No matching landing screens selected.');
const viewports = [
  { name: 'desktop', width: 1440, height: 810 },
  { name: 'mobile', width: 390, height: 780 },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const viewport of viewports) {
    for (const screen of selectedScreens) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-11-07T03:00:00Z'));
      await page.addInitScript((role) => localStorage.setItem('fairplay:preview-role', role), screen.role || 'leader');
      await page.goto('/preview/main');
      await expect(page.locator('.preview-toolbar')).toBeVisible();
      if (screen.scenario !== 'active') {
        await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
        await page.getByLabel('미리보기 상황', { exact: true }).selectOption(screen.scenario);
      }
      await page.goto(screen.path || `/preview/spaces/1/teams/1/${screen.route}`);
      await expect(page.getByRole('main').getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
      await expect(page.locator('.skeleton, .resource-loading')).toHaveCount(0);
      if (screen.name === 'tasks') await expect(page.locator('.task-board-page .board-task-card').first()).toBeVisible();
      if (screen.name === 'report') {
        await expect(page.getByRole('region', { name: '나의 종합 평가 요약', exact: true })).toBeVisible();
        const calculation = page.locator('.report-calculation-details');
        if (await calculation.getAttribute('open') === null) await calculation.locator('summary').click();
        expect(await page.locator('.report-composition-track > span').evaluateAll((segments) =>
          segments.map((segment) => getComputedStyle(segment).backgroundColor)))
          .toEqual(['rgb(0, 168, 107)', 'rgb(37, 99, 235)', 'rgb(250, 204, 21)']);
        // Keep the real mobile layout's collapsed calculation in the final capture.
        if (viewport.name === 'mobile') await calculation.locator('summary').click();
      }
      if (screen.name === 'manager') await expect(page.locator('.dashboard-team-row:visible, .dashboard-team-card:visible').first()).toBeVisible();
      // This switch belongs to the preview environment, not to the product being introduced.
      // Hide it only in the capture page; the actual application's controls stay unchanged.
      await page.addStyleTag({ content: '.topbar .preview-toolbar { display: none !important; }' });
      await expect(page.locator('.topbar .preview-toolbar')).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(errors).toEqual([]);
      const path = `${output}${screen.name}-${viewport.name}.jpg`;
      await page.screenshot({ path, type: 'jpeg', quality: 88, animations: 'disabled' });
      console.log(`Captured ${screen.path || screen.route} (${viewport.width}×${viewport.height}) → ${path}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

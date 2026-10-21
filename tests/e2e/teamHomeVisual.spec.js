import { test, expect } from '@playwright/test';
import { addDashboardWidgets } from './helpers/teamDashboard.js';

for (const width of [1920, 1440, 1024, 768, 390, 320]) {
  test(
    width + 'px 팀 홈은 기본 위젯과 추가 위젯이 넘치지 않는다',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/preview/spaces/1/teams/1');
      const home = page.locator('.team-dashboard');
      await expect(
        home.getByRole('heading', { name: '삼위일체', exact: true }),
      ).toBeVisible();
      const ring = home.getByRole('progressbar', {
        name: '예상 작업량을 반영한 팀 진행률',
      });
      await expect(ring).toHaveAttribute('aria-valuenow', '50');
      await expect(
        home.getByRole('region', { name: '직접 등록 일정 캘린더' }),
      ).toBeVisible();
      await expect(home.locator('.dashboard-widget')).toHaveCount(3);
      await addDashboardWidgets(page, [
        '지금 확인할 작업',
        '내 작업 현황',
        '우리 팀',
        '빠른 메모',
      ]);
      await expect(home.locator('.dashboard-widget')).toHaveCount(7);
      await expect(home.locator('.dashboard-work-metric > strong')).toHaveText([
        '70.00%',
        '40.00%',
        '57.14%',
      ]);
      await expect(home.locator('img')).toHaveCount(0);
      for (const selector of [
        '.dashboard-card',
        '.dashboard-attention button',
        '.dashboard-work-metric',
      ]) {
        expect(
          await home
            .locator(selector)
            .evaluateAll((elements) =>
              elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
            ),
        ).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      if (width > 1250) {
        const progress = await home
          .locator('.dashboard-team-progress')
          .boundingBox();
        const calendar = await home
          .locator('.dashboard-calendar')
          .boundingBox();
        expect(calendar.x + calendar.width).toBeLessThan(progress.x);
        expect(progress.y).toBe(calendar.y);
        expect(Math.abs(progress.height - calendar.height)).toBeLessThanOrEqual(
          1,
        );
      } else {
        const calendar = await home
          .locator('.dashboard-calendar')
          .boundingBox();
        const progress = await home
          .locator('.dashboard-team-progress')
          .boundingBox();
        expect(calendar.y + calendar.height).toBeLessThan(progress.y);
      }
    },
  );
}

test('물음표는 키보드로 지표 설명 모달을 열고 닫는다', async ({ page }) => {
  await page.goto('/preview/spaces/1/teams/1');
  const trigger = page.getByRole('button', {
    name: '팀 전체 진행률 계산 기준',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog', {
    name: '팀 전체 진행률 계산 기준',
    exact: true,
  });
  await expect(modal.getByRole('term')).toHaveCount(4);
  await expect(modal).toContainText('내 담당 분량 ÷ 팀 전체 분량');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await addDashboardWidgets(page, ['내 작업 현황']);
  await page
    .getByRole('button', { name: '내 작업 현황 계산 기준', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '내 작업 현황 계산 기준', exact: true }),
  ).toContainText('내 완료 분량 ÷ 내 담당 분량');
});

test('6주인 달과 계산 기준을 펼친 상태에서도 두 기본 카드 높이를 맞춘다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/preview/spaces/1/teams/1');
  await expect(
    page.getByRole('progressbar', { name: '예상 작업량을 반영한 팀 진행률' }),
  ).toHaveAttribute('aria-valuenow', '50');
  const calendar = page.locator('.dashboard-calendar');
  const progress = page.locator('.dashboard-team-progress');
  await page.getByRole('button', { name: '위젯 편집', exact: true }).click();
  await page
    .getByRole('button', { name: '팀 전체 진행률 앞으로 이동', exact: true })
    .click();
  await page
    .getByRole('button', { name: '팀 전체 진행률 뒤로 이동', exact: true })
    .click();
  await page.getByRole('button', { name: '편집 완료', exact: true }).click();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith('fairplay:team-home:'),
    );
    const state = JSON.parse(localStorage.getItem(key));
    state.events = Array.from({ length: 5 }, (_, index) => ({
      id: `dense-${index}`,
      title: `회의 ${index}`,
      date: '2026-01-01',
      kind: 'meeting',
      start: '',
      end: '',
      notes: '',
      schedule: {
        mode: 'repeat',
        frequency: 'weekly',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-01-01',
        endDate: '',
      },
    }));
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await calendar.getByRole('button', { name: '이전 달', exact: true }).click();
  await calendar.getByRole('button', { name: '이전 달', exact: true }).click();
  await expect(calendar.locator('.team-calendar-grid > button')).toHaveCount(
    42,
  );
  const checkHeight = async () => {
    const left = await calendar.boundingBox();
    const right = await progress.boundingBox();
    expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
  };
  await checkHeight();
  expect(
    await calendar.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  await progress
    .getByRole('button', { name: '팀 전체 진행률 계산 기준', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '팀 전체 진행률 계산 기준', exact: true }),
  ).toBeVisible();
  await checkHeight();
});

test('평가와 리포트 위젯은 기존 팀 메뉴로 연결된다', async ({ page }) => {
  await page.goto('/preview/spaces/1/teams/1');
  await addDashboardWidgets(page, ['동료 평가 작성', '리포트 보기']);
  await page
    .locator('.widget-evaluation')
    .getByRole('button', { name: '동료 평가 작성', exact: true })
    .click();
  await expect(page).toHaveURL(/\/peer-evaluations$/);
  await page.goBack();
  await page
    .getByRole('button', { name: '공개 리포트 보기', exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports$/);
});

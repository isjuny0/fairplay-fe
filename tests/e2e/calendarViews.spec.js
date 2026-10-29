import { test, expect } from '@playwright/test';

for (const width of [1440, 390, 320]) {
  test(`${width}px 월간은 기간 양 끝의 점만, 2주 보기는 날짜별 최대 다섯 일정을 표시한다`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1/teams/1');
    await page.getByRole('button', { name: '위젯 편집', exact: true }).click();
    await page
      .getByRole('button', { name: '팀 전체 진행률 앞으로 이동', exact: true })
      .click();
    await page
      .getByRole('button', { name: '팀 전체 진행률 뒤로 이동', exact: true })
      .click();
    await page.getByRole('button', { name: '편집 완료', exact: true }).click();
    await page.evaluate(async () => {
      const key = Object.keys(localStorage).find((key) =>
        key.startsWith('fairplay:mock:v9:'),
      );
      const state = JSON.parse(localStorage.getItem(key));
      state.events = Array.from({ length: 7 }, (_, index) => ({
        id: `single-${index}`,
        title: `회의 ${index + 1}`,
        date: '2026-10-21',
        kind: index % 2 ? 'review' : 'meeting',
        start: '',
        end: '',
        notes: '',
      }));
      state.events.push({
        id: 'range',
        title: '집중 작업',
        date: '2026-10-20',
        kind: 'work',
        start: '',
        end: '',
        notes: '',
        schedule: {
          mode: 'range',
          startDate: '2026-10-20',
          endDate: '2026-10-23',
        },
      });
      const { calendarEventRequest } =
        await import('/src/lib/calendarEventContract.js');
      state.calendarEvents = state.events.map((event, index) => ({
        ...calendarEventRequest(event),
        id: index + 1,
        teamId: 1,
        authorId: 'seed',
        version: 0,
      }));
      delete state.events;
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload();
    const calendar = page.getByRole('region', {
      name: '직접 등록 일정 캘린더',
      exact: true,
    });
    const day = (date) => calendar.locator(`[data-date="${date}"]`);
    await expect(
      calendar.getByRole('button', { name: '월간', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(calendar.locator('.team-calendar-label')).toHaveCount(0);
    await expect(
      day('2026-10-20').locator('.team-calendar-event-dot'),
    ).toHaveCount(1);
    await expect(
      day('2026-10-21').locator('.team-calendar-event-dot'),
    ).toHaveCount(7);
    await expect(
      day('2026-10-22').locator('.team-calendar-event-dot'),
    ).toHaveCount(0);
    await expect(
      day('2026-10-23').locator('.team-calendar-event-dot'),
    ).toHaveCount(1);
    await calendar.getByRole('button', { name: '2주', exact: true }).click();
    await expect(calendar.locator('.team-calendar-grid > button')).toHaveCount(
      14,
    );
    await expect(calendar.locator('.team-calendar-grid')).toHaveAttribute(
      'aria-label',
      '2026-10-18부터 2026-10-31까지 2주 날짜',
    );
    await expect(day('2026-10-21').locator('.team-calendar-label')).toHaveCount(
      5,
    );
    await expect(
      day('2026-10-22').locator('.team-calendar-label.is-range'),
    ).toHaveCount(1);
    expect(
      await calendar.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    const cellBox = await day('2026-10-21').boundingBox();
    const lastLabel = await day('2026-10-21')
      .locator('.team-calendar-label')
      .last()
      .boundingBox();
    expect(lastLabel.y + lastLabel.height).toBeLessThanOrEqual(
      cellBox.y + cellBox.height,
    );
    await day('2026-10-21').click();
    const detail = page.locator('.team-calendar-day-dialog');
    await expect(detail.locator('.team-calendar-agenda-event')).toHaveCount(8);
    await detail.getByRole('button', { name: '닫기', exact: true }).click();
    await calendar
      .getByRole('button', { name: '다음 2주', exact: true })
      .click();
    await expect(calendar.locator('[data-date="2026-11-01"]')).toBeVisible();
    await calendar
      .getByRole('button', { name: '이전 2주', exact: true })
      .click();
    await expect(day('2026-10-21').locator('.team-calendar-label')).toHaveCount(
      5,
    );
    await calendar.getByRole('button', { name: '월간', exact: true }).click();
    await expect(calendar.locator('.team-calendar-label')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

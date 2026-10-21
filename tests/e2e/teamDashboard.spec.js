import { test, expect } from '@playwright/test';
import {
  addDashboardWidgets,
  selectCalendarEventDate,
  openCalendarEventEditor,
} from './helpers/teamDashboard.js';

test('위젯을 선택·재정렬·제거하고 메모와 구성이 새로고침 후 유지된다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  await addDashboardWidgets(page, [
    '지금 확인할 작업',
    '다가오는 작업',
    '빠른 메모',
    '작업 상태 요약',
  ]);
  await page
    .getByRole('textbox', { name: '빠른 메모', exact: true })
    .fill('다음 회의에서 설문 결과 공유하기');
  await page.getByRole('button', { name: '위젯 편집', exact: true }).click();
  await page
    .getByRole('button', { name: '빠른 메모 앞으로 이동', exact: true })
    .click();
  await expect(page.locator('.dashboard-widget h2')).toHaveText([
    '캘린더',
    '팀 전체 진행률',
    '내 기여도',
    '지금 확인할 작업',
    '빠른 메모',
    '다가오는 작업',
    '작업 상태 요약',
  ]);
  await page
    .getByRole('button', { name: '다가오는 작업 위젯 제거', exact: true })
    .click();
  await page.getByRole('button', { name: '편집 완료', exact: true }).click();
  await page.reload();
  await expect(page.locator('.dashboard-widget h2')).toHaveText([
    '캘린더',
    '팀 전체 진행률',
    '내 기여도',
    '지금 확인할 작업',
    '빠른 메모',
    '작업 상태 요약',
  ]);
  await expect(
    page.getByRole('textbox', { name: '빠른 메모', exact: true }),
  ).toHaveValue('다음 회의에서 설문 결과 공유하기');
  await expect(page.locator('.dashboard-status-list li')).toHaveCount(4);
});

test('직접 등록 캘린더는 시간 검증과 일정 추가·수정·삭제를 지원한다', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
  const mutations = [];
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/') &&
      request.method() !== 'GET'
    )
      mutations.push(request.url());
  });
  await page.goto('/preview/spaces/1/teams/1');
  await openCalendarEventEditor(page);
  const dialog = page.getByRole('dialog', { name: /^일정 (추가|수정)$/ });
  await dialog
    .getByLabel('일정 이름', { exact: true })
    .fill('우리 팀 주간 회의');
  await selectCalendarEventDate(page, '2027-02-18');
  await dialog.getByText('시간·메모 추가', { exact: true }).click();
  await dialog.getByLabel('시작 시간', { exact: true }).fill('14:00');
  await dialog.getByLabel('종료 시간', { exact: true }).fill('13:00');
  await dialog.getByRole('button', { name: '일정 저장', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    '종료 시간은 시작 시간보다 늦어야',
  );
  await dialog.getByLabel('종료 시간', { exact: true }).fill('15:00');
  await dialog.getByLabel('메모', { exact: true }).fill('디자인 시안 리뷰');
  await dialog.getByRole('button', { name: '일정 저장', exact: true }).click();
  const calendar = page.getByRole('region', { name: '직접 등록 일정 캘린더' });
  await expect(
    calendar.getByRole('heading', { name: '2027년 2월', exact: true }),
  ).toBeVisible();
  await expect(
    calendar.getByRole('button', {
      name: '우리 팀 주간 회의 일정 수정',
      exact: true,
    }),
  ).toContainText('14:00 – 15:00');
  await page.reload();
  for (let i = 0; i < 4; i++)
    await calendar
      .getByRole('button', { name: '다음 달', exact: true })
      .click();
  await calendar
    .getByRole('button', { name: '2027년 2월 18일, 일정 1개', exact: true })
    .click();
  await expect(
    calendar.getByRole('button', {
      name: '우리 팀 주간 회의 일정 수정',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '새 일정 추가', exact: true })
    .click();
  await dialog.getByLabel('일정 이름', { exact: true }).fill('종일 일정');
  await selectCalendarEventDate(page, '2027-02-18');
  await dialog.getByRole('button', { name: '일정 저장', exact: true }).click();
  await calendar
    .getByRole('button', { name: '우리 팀 주간 회의 일정 수정', exact: true })
    .click();
  await expect(dialog.getByLabel('메모', { exact: true })).toHaveValue(
    '디자인 시안 리뷰',
  );
  await dialog.getByLabel('일정 이름', { exact: true }).fill('디자인 회의');
  await dialog
    .getByRole('button', { name: '카테고리: 회의', exact: true })
    .click();
  await dialog.getByRole('radio', { name: '주요 일정', exact: true }).click();
  await dialog.getByRole('button', { name: '일정 저장', exact: true }).click();
  await calendar
    .getByRole('button', { name: '디자인 회의 일정 수정', exact: true })
    .click();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('dialog', { name: '일정 삭제', exact: true })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(
    calendar.getByRole('button', {
      name: '디자인 회의 일정 수정',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    calendar.getByRole('button', { name: '종일 일정 일정 수정', exact: true }),
  ).toContainText('종일');
  expect(mutations).toEqual([]);
});

test('캘린더 날짜는 키보드로 달 경계를 이동해도 오늘 표시가 바뀌지 않는다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  const calendar = page.getByRole('region', { name: '직접 등록 일정 캘린더' });
  const current = calendar.locator('[aria-current="date"]');
  const today = await current.getAttribute('data-date');
  const label = await current.getAttribute('aria-label');
  const [year, month] = today.split('-');
  const lastMonth = new Date(Date.UTC(Number(year), Number(month) - 1, 0));
  await calendar.locator(`[data-date="${year}-${month}-01"]`).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(
    calendar.locator('.team-calendar-grid [aria-pressed="true"]'),
  ).toHaveAttribute('data-date', lastMonth.toISOString().slice(0, 10));
  await calendar.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(
    calendar.getByRole('button', { name: label, exact: true }),
  ).toHaveAttribute('aria-current', 'date');
  await expect(
    calendar.locator(`[data-date="${today}"] .team-calendar-day-number`),
  ).toHaveCSS('background-color', 'rgb(8, 124, 85)');
});

test('역할 변경 시 다른 사용자에게 개인 위젯·일정·메모가 보이지 않는다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  await addDashboardWidgets(page, ['빠른 메모']);
  await page
    .getByRole('textbox', { name: '빠른 메모', exact: true })
    .fill('리더만 보는 메모');
  await page.getByLabel('미리보기 역할').selectOption('member');
  await page.goto('/preview/spaces/1/teams/1');
  await expect(page.locator('.dashboard-heading h1')).toHaveText('삼위일체');
  await expect(page.locator('.dashboard-widget')).toHaveCount(3);
  await page.getByLabel('미리보기 역할').selectOption('leader');
  await page.goto('/preview/spaces/1/teams/1');
  await expect(
    page.getByRole('textbox', { name: '빠른 메모', exact: true }),
  ).toHaveValue('리더만 보는 메모');
});

test('저장소 용량 오류를 안내하고 캘린더 화면은 계속 사용할 수 있다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await addDashboardWidgets(page, ['빠른 메모']);
  await expect(page.locator('.dashboard-storage-error')).toBeVisible();
  await expect(page.locator('.widget-memo')).toBeVisible();
  await expect(
    page.locator('.team-calendar-grid > button').first(),
  ).toBeEnabled();
});

for (const width of [390, 320]) {
  test(`${width}px 캘린더는 색상 라벨과 카테고리 선택을 지원하고 상세 창이 하단에 열린다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    const calendar = page.getByRole('region', {
      name: '직접 등록 일정 캘린더',
    });
    const today = calendar.locator('[aria-current="date"]');
    await today.click();
    const detail = page.locator('.team-calendar-day-dialog [role="dialog"]');
    await expect(
      detail.getByText('아직 등록된 일정이 없어요', { exact: true }),
    ).toBeVisible();
    await expect(detail.locator('.team-calendar-relative')).toHaveText('오늘');
    // Wait for the optional entry animation before measuring the sheet edge.
    await detail.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );
    const bounds = await detail.boundingBox();
    expect(bounds.x).toBe(0);
    expect(Math.round(bounds.y + bounds.height)).toBe(900);
    for (const [index, title] of [
      '디자인 시안 리뷰',
      '이번 주 작업 함께 정리',
      '화면 구성 논의',
    ].entries()) {
      await detail
        .getByRole('button', { name: '새 일정 추가', exact: true })
        .click();
      const editor = page.getByRole('dialog', {
        name: '일정 추가',
        exact: true,
      });
      await editor.getByLabel('일정 이름', { exact: true }).fill(title);
      if (index === 0) {
        await editor
          .getByRole('button', { name: '카테고리: 회의', exact: true })
          .click();
        await editor.getByRole('radio', { name: '리뷰', exact: true }).click();
        await expect(
          editor.getByRole('button', { name: '카테고리: 리뷰', exact: true }),
        ).toBeVisible();
        await expect(editor.getByLabel('일정 이름', { exact: true })).toHaveCSS(
          'font-size',
          '22px',
        );
      }
      await editor
        .getByRole('button', { name: '일정 저장', exact: true })
        .click();
      await expect(detail.getByRole('status')).toContainText(
        '일정을 저장했습니다.',
      );
    }
    await detail.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(today.locator('.team-calendar-label')).toHaveCount(0);
    await expect(today.locator('.team-calendar-event-dot')).toHaveCount(3);
    await expect(today.locator('.team-calendar-more')).toHaveCount(0);
    await expect(today.locator('.event-review')).toHaveCSS(
      'background-color',
      'rgb(165, 150, 206)',
    );
    expect(
      await calendar
        .locator('.team-calendar-day')
        .evaluateAll((elements) =>
          elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await today.click();
    await expect(
      detail.getByRole('button', {
        name: '디자인 시안 리뷰 일정 수정',
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);
    await expect(today).toBeFocused();
  });
}

for (const width of [1440, 390, 320]) {
  test(`${width}px 일정 날짜 선택은 원형 달력에서 고르고 체크로 적용한다`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    await openCalendarEventEditor(page);
    const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
    const trigger = editor.getByRole('button', {
      name: '날짜 선택',
      exact: true,
    });
    await trigger.click();
    const picker = page.getByRole('region', { name: '날짜 선택', exact: true });
    const selected = picker.getByRole('button', {
      name: '2026년 10월 13일',
      exact: true,
    });
    await selected.click();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(selected.locator('span')).toHaveCSS(
      'background-color',
      'rgb(8, 124, 85)',
    );
    await expect(picker.locator('[aria-current="date"] > span')).toHaveCSS(
      'background-color',
      'rgb(226, 232, 228)',
    );
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(trigger).toContainText('10월 21일');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await picker
      .getByRole('button', { name: '2026년 10월 13일', exact: true })
      .focus();
    await page.keyboard.press('ArrowRight');
    await expect(picker.locator('[data-date="2026-10-14"]')).toBeFocused();
    await picker
      .getByRole('button', { name: '선택한 날짜 적용', exact: true })
      .click();
    await expect(trigger).toContainText('10월 14일');
    await trigger.click();
    await picker.getByRole('button', { name: '다음 달', exact: true }).click();
    await expect(picker.locator('.team-calendar-picker-grid')).toHaveAttribute(
      'data-month',
      '2026-11',
    );
    await picker.getByRole('button', { name: '오늘', exact: true }).click();
    await expect(picker.locator('[data-date="2026-10-21"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await picker.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

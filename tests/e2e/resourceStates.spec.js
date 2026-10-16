import { test, expect } from '@playwright/test';
import {
  members,
  space,
  team,
  tasks,
  deliverablePage,
} from './helpers/resourceFixtures.js';

async function fixture(page) {
  const state = { pausedPage: null, release: null, errorStatus: null };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const respond = (json, status = 200) => route.fulfill({ status, json });
    if (path === '/api/me')
      return respond({ id: 'member', name: members[0].name });
    if (path === '/api/spaces') return respond([space]);
    if (path === '/api/spaces/1') return respond(space);
    if (path === '/api/spaces/1/teams') return respond([team]);
    if (path === '/api/teams/1') return respond(team);
    if (path === '/api/teams/1/members') return respond(members);
    if (path === '/api/teams/1/tasks') return respond(tasks);
    if (path === '/api/teams/1/deletion-request')
      return respond(
        {
          code: 'TEAM_DELETION_REQUEST_NOT_FOUND',
          message: '삭제 요청이 없습니다.',
        },
        404,
      );
    if (path === '/api/teams/1/deliverables') {
      const pageIndex = Number(url.searchParams.get('page') || 0);
      if (state.pausedPage === pageIndex)
        await new Promise((resolve) => {
          state.release = resolve;
        });
      if (state.errorStatus)
        return respond(
          {
            code: 'FIXTURE_ERROR',
            message: `자료 조회 오류: ${'LongFileNameWithoutSpaces'.repeat(30)}`,
          },
          state.errorStatus,
        );
      return respond(deliverablePage(pageIndex));
    }
    return respond({ code: 'UNEXPECTED_TEST_API', message: `${path}` }, 501);
  });
  return state;
}

test('페이지 변경은 이전 자료를 숨기고 같은 페이지 새로고침은 이전 결과임을 안내한다', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/spaces/1/teams/1/deliverables');
  const previousTitle = deliverablePage(0)[0].title;
  await expect(
    page.getByRole('button', { name: previousTitle, exact: true }),
  ).toBeVisible();
  state.pausedPage = 1;
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(
    page.getByRole('status', { name: '산출물 목록 불러오는 중' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: previousTitle, exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.pausedPage = null;
  state.release();
  const nextTitle = deliverablePage(1)[0].title;
  await expect(
    page.getByRole('button', { name: nextTitle, exact: true }),
  ).toBeVisible();
  state.release = null;
  state.pausedPage = 1;
  await page
    .locator('.deliverables-section')
    .getByRole('button', { name: '새로고침', exact: true })
    .click();
  await expect(
    page.getByText(/이전 조회 결과를 표시하고 있습니다/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: nextTitle, exact: true }),
  ).toBeVisible();
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.pausedPage = null;
  state.release();
  await expect(
    page.getByText(/이전 조회 결과를 표시하고 있습니다/),
  ).toHaveCount(0);
});

for (const status of [403, 404]) {
  test(`${status} 조회 오류는 재조회 대신 참여 상태·대상 확인과 복귀를 안내한다`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.errorStatus = status;
    await page.goto('/spaces/1/teams/1/deliverables');
    const section = page.locator('.deliverables-section');
    await expect(section.getByRole('alert')).toContainText(
      status === 403 ? '참여 상태' : '대상이 남아 있는지',
    );
    await expect(
      section.getByRole('button', { name: '다시 불러오기', exact: true }),
    ).toHaveCount(0);
    await section
      .getByRole('button', { name: '내 스페이스로 이동', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: '내 스페이스', exact: true }),
    ).toBeVisible();
  });
}

test('긴 오류 문구는 좁은 화면을 넘지 않고 일시 오류는 재조회로 복구한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const state = await fixture(page);
  state.errorStatus = 503;
  await page.goto('/spaces/1/teams/1/deliverables');
  await expect(
    page.locator('.deliverables-section').getByRole('alert'),
  ).toContainText('자료 조회 오류');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  state.errorStatus = null;
  await page
    .getByRole('button', { name: '다시 불러오기', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: deliverablePage(0)[0].title,
      exact: true,
    }),
  ).toBeVisible();
});

test('작업 100건과 긴 파일명 20건은 웹 화면에서 바깥 가로 넘침 없이 조회한다', async ({
  page,
}) => {
  await fixture(page);
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/spaces/1/teams/1/tasks?view=list');
    await expect(
      page.getByRole('table', { name: '정렬된 작업 목록' }).locator('tbody tr'),
    ).toHaveCount(100);
    expect(
      await page.locator('.task-table').evaluate(
        (table) =>
          table.querySelector('th').getBoundingClientRect().width /
          table.getBoundingClientRect().width,
      ),
    ).toBeLessThan(0.3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto('/spaces/1/teams/1/deliverables');
    await expect(
      page
        .getByRole('region', { name: '산출물 목록', exact: true })
        .locator('tbody tr'),
    ).toHaveCount(20);
    expect(
      await page
        .locator('.deliverable-table tbody td:nth-child(4)')
        .evaluateAll((cells) =>
          cells.every((cell) => {
            const text = document.createRange();
            text.selectNodeContents(cell);
            return (
              text.getBoundingClientRect().right <=
              cell.getBoundingClientRect().right
            );
          }),
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: deliverablePage(0)[0].title, exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: '산출물 상세' });
    await expect(dialog).toContainText(
      deliverablePage(0)[0].file.originalFilename,
    );
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
});

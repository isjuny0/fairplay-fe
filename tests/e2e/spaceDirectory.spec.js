import { test, expect } from '@playwright/test';

test('스페이스 이름과 내 역할 조건을 함께 적용하고 초기화 후 이동할 수 있다', async ({
  page,
}) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { id: 'user-1', name: '테스트 사용자' } }),
  );
  const spaces = [
    {
      id: 1,
      name: '서비스 디자인',
      myRole: 'USER',
      teamBuildingStatus: 'OPEN',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
    {
      id: 2,
      name: '서비스 개발',
      myRole: 'MANAGER',
      teamBuildingStatus: 'NOT_CONFIGURED',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
    {
      id: 3,
      name: '공모전',
      myRole: 'USER',
      teamBuildingStatus: 'CLOSED',
      startAt: '2026-09-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:00+09:00',
    },
  ];
  await page.route('**/api/spaces', (route) => route.fulfill({ json: spaces }));
  await page.goto('/main');
  const list = page.getByRole('region', { name: '스페이스 목록', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('스페이스 이름 검색').fill('서비스');
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('내 역할 필터').selectOption({ label: '참여자' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('서비스 디자인');
  await page.getByLabel('스페이스 이름 검색').fill('없는 공간');
  await expect(
    page.getByText('조건에 맞는 스페이스가 없습니다.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '검색·필터 초기화' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.route('**/api/spaces/2', (route) =>
    route.fulfill({
      json: {
        ...spaces[1],
        teamBuildingOpensAt: null,
        teamBuildingClosesAt: null,
      },
    }),
  );
  await page.route('**/api/spaces/2/teams', (route) =>
    route.fulfill({ json: [] }),
  );
  await list.getByRole('button').filter({ hasText: '서비스 개발' }).click();
  await expect(page).toHaveURL(/\/spaces\/2$/);
  await expect(
    page.getByRole('heading', { name: '서비스 개발', exact: true }),
  ).toBeVisible();
});

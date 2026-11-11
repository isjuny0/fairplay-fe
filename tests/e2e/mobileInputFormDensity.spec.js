import { test, expect } from '@playwright/test';
import { formatMeetingRecord } from '../../src/lib/meetingRecord.js';

const team = '/preview/spaces/1/teams/1';
for (const [width, height] of [[320, 844], [390, 500], [390, 1248], [481, 1248], [720, 1000]]) {
  test(`${width}×${height}: 회의록 입력폼의 여백을 줄이고 입력·단계·하단 동작을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [path, action, title, field] of [
      ['meeting-minutes', '회의록 등록', '팀 회의록 등록', '제목'],
    ]) {
      await page.goto(`${team}/${path}`);
      await page.getByRole('button', { name: action, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      const before = await dialog.boundingBox();
      expect(before.height).toBeLessThanOrEqual(680);
      expect(before.height).toBeLessThanOrEqual(height - 24);
      expect(before.y).toBeGreaterThanOrEqual(0);
      expect(before.y + before.height).toBeLessThanOrEqual(height);
      await expect(dialog.getByLabel(field, { exact: true })).toHaveCSS('font-size', '16px');
      await dialog.getByLabel(field, { exact: true }).fill('모바일 간격 확인');
      const dateLabel = '회의일시';
      const date = await dialog.getByLabel(`${dateLabel} 날짜`, { exact: true }).boundingBox();
      const time = await dialog.getByLabel(`${dateLabel} 시간`, { exact: true }).boundingBox();
      expect(Math.abs(date.y - time.y)).toBeLessThan(1);
      expect(time.x).toBeGreaterThanOrEqual(date.x + date.width);
      const next = dialog.getByRole('button', { name: '다음', exact: true });
      await expect(next).toBeInViewport();
      expect((await next.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await next.click();
      expect(await dialog.boundingBox()).toEqual(before);
      await expect(dialog.getByRole('button', { name: '이전', exact: true })).toBeInViewport();
      if (path === 'meeting-minutes') {
        const editor = dialog.getByRole('textbox', { name: '회의 기록', exact: true });
        await expect(editor).toBeVisible();
        const box = await editor.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(180);
        expect(box.height).toBeLessThanOrEqual(240);
        await editor.fill(formatMeetingRecord({ agenda: '**모바일에서 적은 안건**' }));
        await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
        await expect(dialog.getByRole('region', { name: '본문 미리보기' })).toContainText('모바일에서 적은 안건');
      }
      await dialog.getByRole('button', { name: '이전', exact: true }).click();
      await expect(dialog.getByLabel(field, { exact: true })).toHaveValue('모바일 간격 확인');
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('데스크톱 입력폼 높이는 기존 크기를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [path, action, expected] of [['tasks', '새 작업 만들기', 800], ['meeting-minutes', '회의록 등록', 760]]) {
    await page.goto(`${team}/${path}`);
    await page.getByRole('button', { name: action, exact: true }).click();
    expect((await page.getByRole('dialog').boundingBox()).height).toBe(expected);
  }
});


for (const [width, height] of [[320, 844], [390, 500], [481, 1248], [720, 1000]]) {
  test(`${width}×${height}: 작업 등록·수정 모달은 회의록 크기와 같고 항목 간격은 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${team}/meeting-minutes`);
    await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
    const meetingBox = await page.getByRole('dialog', { name: '팀 회의록 등록', exact: true }).boundingBox();
    for (const editing of [false, true]) {
      await page.goto(`${team}/tasks${editing ? '/102' : ''}`);
      await page.getByRole('button', { name: editing ? '작업 수정' : '새 작업 만들기', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: editing ? '작업 수정' : '새 작업 만들기', exact: true });
      expect(await dialog.boundingBox()).toEqual(meetingBox);
      expect((await dialog.getByLabel('작업 설명', { exact: true }).boundingBox()).height).toBeGreaterThan(104);
      await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
      await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeInViewport();
      if (!editing) {
        await dialog.getByLabel('작업 제목', { exact: true }).fill('모달 크기 확인');
        await dialog.getByLabel('작업 설명', { exact: true }).fill('계획 단계로 이동해도 같은 크기를 유지합니다.');
        await dialog.getByRole('button', { name: '다음', exact: true }).click();
        expect(await dialog.boundingBox()).toEqual(meetingBox);
        await expect(dialog.getByLabel('시작일 시간', { exact: true })).toHaveValue('00:00');
        await expect(dialog.getByLabel('마감 시간', { exact: true })).toHaveValue('00:00');
      }
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });
}

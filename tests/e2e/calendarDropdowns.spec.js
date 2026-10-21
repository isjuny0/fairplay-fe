import { test, expect } from '@playwright/test';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

for (const width of [1440, 390, 320]) {
  test(`${width}px 날짜와 카테고리는 겹쳐 뜨고 작성창 크기와 입력 위치를 유지한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
    await page.goto('/preview/spaces/1/teams/1');
    await openCalendarEventEditor(page);
    const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
    const date = editor.getByRole('button', { name: '날짜 선택', exact: true });
    const dialogCount = await page.getByRole('dialog').count();
    const originalBox = await editor.boundingBox();
    const extras = editor.getByText('시간·메모 추가', { exact: true });
    const extrasY = (await extras.boundingBox()).y;
    await date.click();
    const picker = editor.getByRole('region', {
      name: '날짜 선택',
      exact: true,
    });
    await expect(picker).toBeVisible();
    expect(
      Math.abs(
        (await picker.boundingBox()).width - (await date.boundingBox()).width,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(picker.getByText('선택 후', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(dialogCount);
    expect(
      Math.abs((await editor.boundingBox()).height - originalBox.height),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((await extras.boundingBox()).y - extrasY),
    ).toBeLessThanOrEqual(1);
    const fixedHeight = (await picker.boundingBox()).height;
    for (const mode of ['기간', '반복', '다중', '일반']) {
      await picker.getByRole('tab', { name: mode, exact: true }).click();
      expect(
        Math.abs((await picker.boundingBox()).height - fixedHeight),
      ).toBeLessThanOrEqual(1);
      expect(
        await picker.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
      if (mode === '반복') {
        await picker
          .getByRole('button', { name: '반복 시작 날짜', exact: true })
          .click();
        expect(
          await picker.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
        const box = await picker.boundingBox();
        expect(Math.abs(box.height - fixedHeight)).toBeLessThanOrEqual(1);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(1000);
      }
    }
    await expect(
      picker.getByRole('button', { name: '선택한 날짜 적용', exact: true }),
    ).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    const apply = picker.getByRole('button', {
      name: '선택한 날짜 적용',
      exact: true,
    });
    await expect(apply).toHaveCSS('font-weight', '700');
    const applyBounds = await apply.boundingBox(),
      pickerBounds = await picker.boundingBox();
    expect(
      pickerBounds.x + pickerBounds.width - applyBounds.x - applyBounds.width,
    ).toBeLessThanOrEqual(18);
    expect(
      pickerBounds.y + pickerBounds.height - applyBounds.y - applyBounds.height,
    ).toBeLessThanOrEqual(18);
    await picker
      .getByRole('button', { name: '2026년 10월 23일', exact: true })
      .click();
    await picker
      .getByRole('button', { name: '선택한 날짜 적용', exact: true })
      .click();
    await expect(date).toContainText('10월 23일');
    await expect(picker).toHaveCount(0);
    const category = editor.getByRole('button', {
      name: '카테고리: 회의',
      exact: true,
    });
    await category.click();
    const choices = editor.getByRole('radiogroup', {
      name: '일정 종류',
      exact: true,
    });
    const choiceBox = await choices.boundingBox(),
      categoryBox = await category.boundingBox();
    expect(
      choiceBox.y >= categoryBox.y + categoryBox.height ||
        choiceBox.y + choiceBox.height <= categoryBox.y,
    ).toBe(true);
    expect(choiceBox.width).toBeLessThanOrEqual(categoryBox.width);
    expect(
      Math.abs((await extras.boundingBox()).y - extrasY),
    ).toBeLessThanOrEqual(1);
    await choices.getByRole('radio', { name: '리뷰', exact: true }).click();
    await expect(choices).toHaveCount(0);
    await editor.getByText('시간·메모 추가', { exact: true }).click();
    await editor
      .getByRole('button', { name: '시작 시간 선택 열기', exact: true })
      .click();
    const time = editor.getByRole('region', { name: '시간 선택', exact: true });
    const timeBox = await time.boundingBox(),
      inputBox = await editor
        .getByLabel('시작 시간', { exact: true })
        .boundingBox();
    expect(Math.abs(timeBox.width - inputBox.width)).toBeLessThanOrEqual(1);
    expect(timeBox.height).toBeLessThanOrEqual(220);
    const applyBox = await time
      .getByRole('button', { name: '시간 적용', exact: true })
      .boundingBox();
    await expect(
      time.getByRole('button', { name: '시간 적용', exact: true }),
    ).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    expect(applyBox.height).toBeLessThanOrEqual(24);
    expect(applyBox.width).toBeLessThan(70);
    await time.getByRole('button', { name: '10시', exact: true }).click();
    await time.getByRole('button', { name: '45분', exact: true }).click();
    await time.getByRole('button', { name: '시간 적용', exact: true }).click();
    await expect(editor.getByLabel('시작 시간', { exact: true })).toHaveValue(
      '10:45',
    );
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  });
}

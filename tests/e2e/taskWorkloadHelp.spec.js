import { test, expect } from '@playwright/test';

for (const width of [1920, 1440, 1024, 768, 390, 320]) {
  test(`${width}px 작업 안내를 정리하고 계산 설명을 작은 도움말로 표시한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await expect(
      editor.getByText(
        '작업 내용과 일정을 정하고, 함께할 담당자를 선택하세요.',
        { exact: true },
      ),
    ).toHaveCount(0);
    await expect(
      editor.getByText('시작일부터 마감까지의 계획 일정입니다.', {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(editor.locator('.form-help')).toHaveCount(0);
    const select = editor.getByLabel('예상 작업량', { exact: true });
    const original = await select.inputValue();
    const hint = editor.getByText(
      '담당자 전체의 예상 시간을 합산해 선택하세요.',
      { exact: true },
    );
    const box = await select.boundingBox();
    const hintBox = await hint.boundingBox();
    expect(hintBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(
      box.x + box.width + 1,
    );

    const trigger = editor.getByRole('button', {
      name: '예상 작업량과 담당 비율 도움말',
      exact: true,
    });
    const help = page.getByRole('dialog', {
      name: '예상 작업량과 담당 비율은 어떻게 사용되나요?',
      exact: true,
    });
    const star = await editor
      .locator('.task-workload-field .required-asterisk')
      .boundingBox();
    const icon = await trigger.boundingBox();
    expect(icon.x - star.x - star.width).toBeGreaterThanOrEqual(0);
    expect(icon.x - star.x - star.width).toBeLessThanOrEqual(8);
    expect(
      Math.abs(icon.y + icon.height / 2 - star.y - star.height / 2),
    ).toBeLessThanOrEqual(1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(help).toHaveCount(0);
    await trigger.click();
    await expect(help).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(help).toContainText(
      '예상 작업량과 담당 비율은 기여도 계산에 반영됩니다.',
    );
    await expect(help).toContainText('팀과 합의해 조정해주세요.');
    await expect(
      help.getByRole('button', { name: '도움말 닫기', exact: true }),
    ).toBeFocused();
    const popup = await help.boundingBox();
    expect(popup.width).toBeLessThanOrEqual(320);
    expect(popup.x).toBeGreaterThanOrEqual(0);
    expect(popup.y).toBeGreaterThanOrEqual(0);
    expect(popup.x + popup.width).toBeLessThanOrEqual(width);
    expect(popup.y + popup.height).toBeLessThanOrEqual(900);
    const after = await select.boundingBox();
    expect(after.y).toBe(box.y);
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(help).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(help).toHaveCount(0);
    await expect(select).toBeFocused();

    await trigger.click();
    await expect(help).toBeVisible();
    await editor.getByLabel('작업 제목', { exact: true }).click();
    await expect(help).toHaveCount(0);
    await trigger.click();
    await help
      .getByRole('button', { name: '도움말 닫기', exact: true })
      .click();
    await expect(help).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(select).toHaveValue(original);
    await expect(editor.getByLabel('작업 제목', { exact: true })).toHaveValue(
      '서비스 흐름 설계',
    );
    await editor.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

import { test, expect } from '@playwright/test';

for (const width of [1440, 390, 320]) {
  test(`${width}px 날짜만 필수로 표시하고 시간을 비워도 기존 시각으로 저장한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await expect(editor.locator('.task-editor-intro')).toHaveCount(0);
    await expect(editor.getByText('필수 입력', { exact: true })).toHaveCount(0);
    const times = [];
    for (const [index, label] of ['시작일', '마감'].entries()) {
      const date = editor.getByRole('textbox', {
        name: `${label} 날짜`,
        exact: true,
      });
      const time = editor.getByRole('textbox', {
        name: `${label} 시간`,
        exact: true,
      });
      await expect(date).toHaveAttribute('required', '');
      await expect(time).not.toHaveAttribute('required', '');
      const group = editor.getByRole('group', { name: label, exact: true });
      await expect(group.locator('.date-time-caption').first()).toHaveText(
        '날짜*',
      );
      await expect(group.locator('.date-time-caption').nth(1)).toHaveText(
        '시간(선택)',
      );
      times.push(await time.inputValue());
      await time.fill('');
      await date.fill(`2030-12-0${index + 1}`);
      await expect(time).toHaveValue('');
    }
    if (width <= 600) {
      await editor
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();
      await editor
        .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
        .click();
    }
    await editor.getByRole('button', { name: '저장', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    for (const [index, label] of ['시작일', '마감'].entries()) {
      await expect(
        editor.getByRole('textbox', { name: `${label} 날짜`, exact: true }),
      ).toHaveValue(`2030-12-0${index + 1}`);
      await expect(
        editor.getByRole('textbox', { name: `${label} 시간`, exact: true }),
      ).toHaveValue(times[index]);
    }
  });

  test(`${width}px 날짜 누락과 잘못 입력한 시간은 오류로 표시한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '작업 수정', exact: true });
    const next = () =>
      editor
        .getByRole('button', {
          name: width <= 600 ? '다음: 담당·배분' : '저장',
          exact: true,
        })
        .click();
    const date = editor.getByRole('textbox', {
      name: '마감 날짜',
      exact: true,
    });
    const original = await date.inputValue();
    await date.fill('');
    await next();
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(date).toBeFocused();
    await date.fill(original);
    const time = editor.getByRole('textbox', {
      name: '마감 시간',
      exact: true,
    });
    await time.fill('25:10');
    await next();
    await expect(
      editor.getByText('시간을 00:00~23:59 형식으로 입력해 주세요.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(editor).toBeVisible();
  });
}

for (const width of [1440, 390]) {
  test(`${width}px 새 작업도 시간 입력 없이 기본 시각으로 저장한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page
      .getByRole('button', { name: '새 작업 만들기', exact: true })
      .click();
    const editor = page.getByRole('dialog', {
      name: '새 작업 만들기',
      exact: true,
    });
    await editor
      .getByLabel('작업 제목', { exact: true })
      .fill('시간 선택 생략');
    await editor
      .getByLabel('작업 설명', { exact: true })
      .fill('날짜만 지정한 작업입니다.');
    const defaults = [];
    for (const [index, label] of ['시작일', '마감'].entries()) {
      const time = editor.getByRole('textbox', {
        name: `${label} 시간`,
        exact: true,
      });
      defaults.push(await time.inputValue());
      await time.fill('');
      await editor
        .getByRole('textbox', { name: `${label} 날짜`, exact: true })
        .fill(`2030-12-0${index + 1}`);
    }
    if (width <= 600)
      await editor
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();
    await editor
      .getByRole('checkbox', { name: '김하늘 · 리더', exact: true })
      .check();
    if (width <= 600)
      await editor
        .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
        .click();
    await editor.getByRole('button', { name: '저장', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '작업 수정', exact: true });
    for (const [index, label] of ['시작일', '마감'].entries()) {
      await expect(
        edit.getByRole('textbox', { name: `${label} 시간`, exact: true }),
      ).toHaveValue(defaults[index]);
    }
  });
}

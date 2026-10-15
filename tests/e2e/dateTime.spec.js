import { test, expect } from '@playwright/test';
import { fillDateTime } from './helpers/dateTime.js';

async function openCreate(page) {
  await page.clock.setFixedTime(new Date('2026-10-12T09:15:00Z'));
  await page.goto('/preview/main');
  await page
    .getByRole('button', { name: '스페이스 만들기', exact: true })
    .click();
  return page.getByRole('dialog');
}

test('새 스페이스 시작·종료 기본값은 현재 날짜·시간이며 기본값만으로 이탈 경고하지 않는다', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  for (const label of [
    '프로젝트 시작',
    '프로젝트 종료',
  ]) {
    await expect(
      dialog.getByRole('textbox', { name: `${label} 날짜`, exact: true }),
    ).toHaveValue('2026-10-12');
    await expect(
      dialog.getByLabel(`${label} 시간`, { exact: true }),
    ).toHaveValue('18:15');
  }
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`날짜 선택 ${width}px: 월·연도 목록 선택과 별도 시간 입력, API 날짜 보존`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openCreate(page);
    await dialog
      .getByLabel('스페이스 이름', { exact: true })
      .fill('날짜 선택 프로젝트');
    await dialog
      .getByRole('button', {
        name: '프로젝트 시작 달력 열기',
        exact: true,
      })
      .click();
    const calendar = dialog.getByRole('region', { name: '날짜 선택 달력' });
    await calendar
      .getByRole('button', { name: '월 선택', exact: true })
      .click();
    await expect(calendar.getByLabel('월 목록')).toBeVisible();
    await expect(
      calendar.getByLabel('월 목록').getByRole('button'),
    ).toHaveCount(12);
    await calendar
      .getByRole('button', { name: '2월 선택', exact: true })
      .click();
    await calendar
      .getByRole('button', { name: '연도 선택', exact: true })
      .click();
    await expect(
      calendar.getByLabel('연도 목록').getByRole('button'),
    ).toHaveCount(12);
    await calendar
      .getByRole('button', { name: '다음 기간', exact: true })
      .click();
    await calendar
      .getByRole('button', { name: '2028년 선택', exact: true })
      .click();
    await calendar
      .getByRole('button', { name: '2월 선택', exact: true })
      .click();
    await calendar
      .getByRole('button', { name: '2028년 2월 29일', exact: true })
      .click();
    await expect(
      dialog.getByLabel('프로젝트 시작 날짜', { exact: true }),
    ).toHaveValue('2028-02-29');
    await expect(
      dialog.getByLabel('프로젝트 시작 시간', { exact: true }),
    ).toHaveValue('18:15');
    await dialog
      .getByLabel('프로젝트 시작 시간', { exact: true })
      .fill('10:45');
    await fillDateTime(dialog, '프로젝트 종료', '2028-03-01T12:30');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await dialog.getByRole('button', { name: '만들기', exact: true }).click();
    await expect(page).toHaveURL(/\/spaces\/3$/);
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('fairplay:mock:v5:preview:1'))
          .extraSpace,
    );
    expect(saved.startAt).toBe('2028-02-29T10:45:00+09:00');
    expect(saved.endAt).toBe('2028-03-01T12:30:00+09:00');
    await page.goto('/preview/main');
    await expect(
      page.getByRole('button', { name: /날짜 선택 프로젝트/ }),
    ).toBeVisible();
  });
}

test('존재하지 않는 날짜와 비어 있는 시간을 거부하고 올바른 입력은 저장한다', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  await dialog.getByLabel('스페이스 이름', { exact: true }).fill('입력 검증');
  await fillDateTime(dialog, '프로젝트 종료', '2026-02-30T19:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(
    dialog.getByLabel('프로젝트 종료 날짜', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await fillDateTime(dialog, '프로젝트 종료', '2026-10-13T19:00');
  await dialog
    .getByLabel('프로젝트 종료 시간', { exact: true })
    .fill('');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(
    dialog.getByLabel('프로젝트 종료 시간', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await dialog
    .getByLabel('프로젝트 종료 시간', { exact: true })
    .fill('19:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/3$/);
});

test('달력 방향키는 다음 달로 이동하고 Escape는 달력만 닫는다', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  await fillDateTime(dialog, '프로젝트 시작', '2026-10-31T18:15');
  const trigger = dialog.getByRole('button', {
    name: '프로젝트 시작 달력 열기',
    exact: true,
  });
  await trigger.click();
  const calendar = dialog.getByRole('region', { name: '날짜 선택 달력' });
  await calendar
    .getByRole('button', { name: '2026년 10월 31일', exact: true })
    .press('ArrowRight');
  await expect(
    calendar.getByRole('button', { name: '2026년 11월 1일', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
});

test('미저장 입력의 버리고 닫기 버튼은 중립 회색이며 기능은 유지한다', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  await dialog.getByLabel('스페이스 이름', { exact: true }).fill('임시 입력');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  const discard = page.getByRole('button', {
    name: '버리고 닫기',
    exact: true,
  });
  await expect(discard).toHaveCSS('background-color', 'rgb(87, 85, 79)');
  await expect(discard).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(discard).not.toHaveClass(/danger/);
  await discard.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [1440, 390, 320]) {
  test(`시간 선택 ${width}px: 시·분을 직접 선택하고 날짜와 기존 시간을 보존한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openCreate(page);
    const trigger = dialog.getByRole('button', {
      name: '프로젝트 시작 시간 선택 열기',
      exact: true,
    });
    await trigger.click();
    const picker = dialog.getByRole('region', {
      name: '시간 선택',
      exact: true,
    });
    const timeBox = await dialog.locator('.time-control').first().boundingBox();
    const pickerBox = await picker.boundingBox();
    expect(pickerBox.width).toBeLessThanOrEqual(216);
    expect(pickerBox.height).toBeLessThanOrEqual(240);
    await expect(picker).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(picker.locator('.time-picker-options').first()).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(
      picker.locator('.time-picker-options [aria-pressed="true"]').first(),
    ).toHaveCSS('background-color', 'rgb(32, 36, 43)');
    await expect(
      picker.getByRole('button', { name: '시간 적용', exact: true }),
    ).toHaveCSS('background-color', 'rgb(32, 36, 43)');
    expect(await picker.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false,
    );
    expect(Math.abs(pickerBox.x - timeBox.x)).toBeLessThanOrEqual(1);
    expect(pickerBox.y).toBeGreaterThanOrEqual(timeBox.y + timeBox.height);
    expect(pickerBox.y - timeBox.y - timeBox.height).toBeLessThanOrEqual(12);
    expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(
      timeBox.x + timeBox.width + 1,
    );
    await expect(
      picker.getByRole('group', { name: '시 선택' }).getByRole('button'),
    ).toHaveCount(24);
    await expect(
      picker.getByRole('group', { name: '분 선택' }).getByRole('button'),
    ).toHaveCount(60);
    for (const name of ['시 선택', '분 선택']) {
      const visibleSelection = await picker
        .getByRole('group', { name })
        .evaluate((list) => {
          const box = list.getBoundingClientRect();
          const selected = list
            .querySelector('[aria-pressed="true"]')
            .getBoundingClientRect();
          return selected.top >= box.top && selected.bottom <= box.bottom;
        });
      expect(visibleSelection).toBe(true);
    }
    await picker.getByRole('button', { name: '09시', exact: true }).click();
    await picker.getByRole('button', { name: '35분', exact: true }).click();
    await expect(picker.getByLabel('선택한 시간')).toHaveText('09:35');
    await expect(
      dialog.getByLabel('프로젝트 시작 시간', { exact: true }),
    ).toHaveValue('18:15');
    await picker
      .getByRole('button', { name: '시간 적용', exact: true })
      .click();
    await expect(
      dialog.getByLabel('프로젝트 시작 시간', { exact: true }),
    ).toHaveValue('09:35');
    await expect(
      dialog.getByLabel('프로젝트 시작 날짜', { exact: true }),
    ).toHaveValue('2026-10-12');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(
      picker.getByRole('button', { name: '09시', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await picker
      .getByRole('button', { name: '현재 시간', exact: true })
      .click();
    await expect(picker.getByLabel('선택한 시간')).toHaveText('18:15');
    await picker
      .getByRole('button', { name: '시간 적용', exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('시간 선택 방향키와 Escape, 날짜·시간 선택기 상호 닫기, 시간 입력 검증', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  const trigger = dialog.getByRole('button', {
    name: '프로젝트 시작 시간 선택 열기',
    exact: true,
  });
  await trigger.click();
  const picker = dialog.getByRole('region', { name: '시간 선택', exact: true });
  await picker
    .getByRole('button', { name: '18시', exact: true })
    .press('ArrowDown');
  await expect(
    picker.getByRole('button', { name: '19시', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(
    dialog.getByLabel('프로젝트 시작 시간', { exact: true }),
  ).toHaveValue('18:15');
  await dialog
    .getByRole('button', {
      name: '프로젝트 시작 달력 열기',
      exact: true,
    })
    .click();
  await trigger.click();
  await expect(
    dialog.getByRole('region', { name: '날짜 선택 달력' }),
  ).toHaveCount(0);
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await dialog.getByLabel('스페이스 이름', { exact: true }).fill('시간 검증');
  await fillDateTime(dialog, '프로젝트 종료', '2026-10-13T24:00');
  await dialog.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(
    dialog.getByLabel('프로젝트 종료 시간', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByText('시간을 00:00~23:59 형식으로 입력해 주세요.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('공통 입력창의 글씨·높이·모서리와 페이지 제목 크기는 같은 기준을 사용한다', async ({
  page,
}) => {
  const dialog = await openCreate(page);
  const fields = dialog.locator('.form-field input, .form-field textarea');
  for (const input of await fields.all()) {
    await expect(input).toHaveCSS('font-size', '14px');
    await expect(input).toHaveCSS('min-height', '36px');
    await expect(input).toHaveCSS('border-radius', '6px');
  }
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  for (const path of [
    '/preview/main',
    '/preview/spaces/1/teams/1',
    '/preview/spaces/1/teams/1/tasks',
    '/preview/spaces/1/teams/1/settings',
  ]) {
    await page.goto(path);
    await expect(page.locator('.main-content h1')).toHaveCSS(
      'font-size',
      '24px',
    );
  }
});

for (const width of [1440, 390]) {
  test(`선택기 겹침 ${width}px: 달력과 시간 패널을 열어도 종료 입력 위치는 유지된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const dialog = await openCreate(page);
    const end = dialog.getByRole('group', {
      name: '프로젝트 종료',
      exact: true,
    });
    const original = await end.boundingBox();
    for (const label of [
      '프로젝트 시작 달력 열기',
      '프로젝트 시작 시간 선택 열기',
    ]) {
      await dialog.getByRole('button', { name: label, exact: true }).click();
      const after = await end.boundingBox();
      expect(Math.abs(after.y - original.y)).toBeLessThanOrEqual(1);
      expect(after.height).toBe(original.height);
      const panel = dialog.locator('.calendar-panel, .time-picker-panel');
      await expect(panel).toHaveCSS('position', 'absolute');
      const box = await panel.boundingBox();
      expect(box.y).toBeLessThan(after.y + after.height);
      expect(box.y + box.height).toBeGreaterThan(after.y);
      await page.keyboard.press('Escape');
    }
  });
}

for (const width of [1920, 1440, 1280]) {
  test(`데스크톱 ${width}px: 현황·읽기 폭을 구분하고 여백·최소 높이와 가로 넘침 방지`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const boxes = [];
    for (const path of [
      '/preview/spaces/1/teams/1',
      '/preview/spaces/1/teams/1/tasks',
      '/preview/spaces/1/teams/1/settings',
      '/preview/spaces/1/teams/1/reports',
    ]) {
      await page.goto(path);
      await expect(page.locator('.main-content')).toBeVisible();
      boxes.push(
        await page.locator('.main-content').evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            width: el.getBoundingClientRect().width,
            padding: style.padding,
            minHeight: style.minHeight,
          };
        }),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
    expect(boxes[1].width).toBe(boxes[0].width);
    for (const box of boxes) {
      expect(box.width).toBeLessThanOrEqual(boxes[0].width);
      expect(box.padding).toBe(boxes[0].padding);
      expect(box.minHeight).toBe(boxes[0].minHeight);
    }
  });
}

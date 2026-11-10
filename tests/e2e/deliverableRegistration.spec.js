import { test, expect } from '@playwright/test';

async function openRegistration(
  page,
  path = '/preview/spaces/1/teams/1/deliverables',
) {
  await page.addInitScript(() =>
    localStorage.setItem('fairplay:preview-role', 'leader'),
  );
  await page.goto(path);
  const registerLabel = path.includes('/tasks/') ? '결과물 추가' : '팀 자료 등록';
  if (path.includes('/tasks/')) {
    await page.getByRole('tab', { name: '결과물', exact: true }).click();
    const heading = page.locator('.linked-deliverables-heading');
    await expect(heading).not.toContainText('현재 페이지');
    await expect(heading.getByRole('button', { name: '새로고침', exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: registerLabel, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^(팀 자료 등록|결과물 추가|문서 작성|파일 업로드)$/, exact: true });
  await expect(dialog).toHaveAccessibleName(registerLabel);
  await expect(dialog.getByRole('button', { name: '문서 작성', exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: '파일 업로드', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: registerLabel, exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  return dialog;
}

async function chooseType(dialog, type) {
  const back = dialog.getByRole('button', { name: '방식 변경', exact: true });
  if (await back.count()) await back.click();
  await dialog.getByRole('button', { name: type, exact: true }).click();
}

const sampleFile = {
  name: 'research.md',
  mimeType: 'text/markdown',
  buffer: Buffer.from('# 조사 자료'),
};

async function savedDeliverable(page, title) {
  return page.evaluate(async (title) => {
    const { getMockState } = await import('/src/mock/planned.js');
    const { previewContext } = await import('/src/mock/preview.js');
    return getMockState(previewContext()).teams[1].deliverables.find(
      (item) => item.title === title,
    );
  }, title);
}

for (const viewport of [
  { width: 1440, height: 900 }, { width: 1280, height: 720 },
  { width: 390, height: 844 }, { width: 320, height: 640 }, { width: 800, height: 500 },
  { width: 474, height: 1244 }, { width: 720, height: 1000 },
]) {
  test(`방식 선택과 입력·등록 버튼이 화면 안에서 동작한다 ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    let meetingBox;
    if (viewport.width <= 720) {
      await page.goto('/preview/spaces/1/teams/1/meeting-minutes');
      await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
      meetingBox = await page.getByRole('dialog', { name: '팀 회의록 등록', exact: true }).boundingBox();
    }
    const dialog = await openRegistration(page);
    await expect(dialog.getByLabel('제목', { exact: true })).toBeFocused();
    await expect(dialog.getByRole('button', { name: '방식 변경', exact: true })).toBeVisible();
    await expect(dialog.getByLabel('설명', { exact: true })).toBeHidden();
    if (viewport.width >= 1000 && viewport.height >= 720) {
      expect(await dialog.locator('.deliverable-editor-scroll').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      await expect(dialog.locator('summary').filter({ hasText: '설명 추가' })).toBeInViewport();
    }
    for (const type of ['문서 작성', '파일 업로드']) {
      await chooseType(dialog, type);
      await expect(dialog).toHaveAccessibleName(type);
      await expect(dialog.getByRole('navigation', { name: '산출물 입력 위치', exact: true })).toHaveCount(0);
      await expect(dialog.locator('.deliverable-selected-method')).toHaveCount(0);
      await expect(dialog.getByLabel(type === '파일 업로드' ? '파일' : '제목', { exact: true })).toBeFocused();
      if (type === '파일 업로드') {
        const fileField = await dialog.getByLabel('파일', { exact: true }).boundingBox();
        const titleField = await dialog.getByLabel('제목', { exact: true }).boundingBox();
        expect(fileField.y + fileField.height).toBeLessThan(titleField.y);
      }
      const box = await dialog.boundingBox();
      if (meetingBox) expect(box).toEqual(meetingBox);
      else expect(box.width).toBe(Math.min(type === '문서 작성' ? 820 : 720, viewport.width - 48));
      expect(box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
      await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeInViewport();
      await expect(dialog.getByRole('button', { name: '팀 자료 등록', exact: true })).toBeInViewport();
      await expect(dialog.getByLabel(type === '문서 작성' ? '본문' : '파일', { exact: true })).toHaveCount(1);
      await expect(dialog.getByLabel(type === '문서 작성' ? '파일' : '본문', { exact: true })).toHaveCount(0);
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ([1440, 390].includes(viewport.width)) await dialog.screenshot({ path: testInfo.outputPath(`${type}.png`) });
    }
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test('유형을 다시 선택해도 초안과 파일을 보존하며 파일 저장에 문서 본문을 섞지 않는다', async ({
  page,
}) => {
  const dialog = await openRegistration(page);
  await chooseType(dialog, '파일 업로드');
  await dialog
    .getByLabel('제목', { exact: true })
    .fill('유형 이동 후 파일 저장');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(sampleFile);
  await chooseType(dialog, '문서 작성');
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue(
    '유형 이동 후 파일 저장',
  );
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('유형을 바꿔도 남아 있어야 하는 문서 초안입니다.');
  await chooseType(dialog, '파일 업로드');
  await expect(dialog.getByRole('status')).toContainText('research.md');
  await dialog.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedDeliverable(page, '유형 이동 후 파일 저장');
  expect(saved.type).toBe('FILE');
  expect(saved.file.originalFilename).toBe('research.md');
  expect(saved.text).toBeFalsy();
});

test('허용하지 않는 파일 초안이 남아 있어도 문서에서는 숨기고 파일 없이 저장한다', async ({
  page,
}) => {
  const dialog = await openRegistration(page);
  await chooseType(dialog, '파일 업로드');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: 'archive.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('unsupported file draft'),
  });
  await chooseType(dialog, '문서 작성');
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await dialog
    .getByLabel('제목', { exact: true })
    .fill('유형 이동 후 문서 저장');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('직접 작성한 문서 본문만 저장합니다.');
  await dialog.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedDeliverable(page, '유형 이동 후 문서 저장');
  expect(saved.type).toBe('TEXT');
  expect(saved.text).toBe('직접 작성한 문서 본문만 저장합니다.');
  expect(saved.file).toBeFalsy();
});

test('선택 방식을 바꾸고 취소해도 미저장 보호와 문서 초안을 유지한다', async ({
  page,
}) => {
  const dialog = await openRegistration(page);
  await chooseType(dialog, '문서 작성');
  await dialog.getByLabel('제목', { exact: true }).fill('보존할 문서 제목');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('보존할 문서 내용입니다.');
  await chooseType(dialog, '파일 업로드');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: '저장하지 않은 변경 사항',
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '취소', exact: true }).click();
  await chooseType(dialog, '문서 작성');
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue(
    '보존할 문서 제목',
  );
  await expect(dialog.getByLabel('본문', { exact: true })).toHaveValue(
    '보존할 문서 내용입니다.',
  );
});

test('작업 상세에서 등록할 때 유형 선택 후에도 작업 연결을 유지한다', async ({
  page,
}) => {
  const dialog = await openRegistration(
    page,
    '/preview/spaces/1/teams/1/tasks/102',
  );
  await chooseType(dialog, '문서 작성');
  await expect(dialog.getByLabel('작업 연결', { exact: true })).toHaveCount(0);
  await expect(dialog).toContainText('팀 자료 검색 개선');
  await dialog.getByLabel('제목', { exact: true }).fill('작업에 연결한 문서');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('담당 작업의 분석 결과와 근거를 작성했습니다.');
  await dialog.getByRole('button', { name: '결과물 추가', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await savedDeliverable(page, '작업에 연결한 문서')).taskId).toBe(102);
  await expect(page.locator('.linked-deliverables .deliverable-context')).toHaveCount(0);
});

test('파일명으로 빈 제목만 채우고 직접 쓴 제목은 보존한다', async ({ page }) => {
  const dialog = await openRegistration(page);
  await chooseType(dialog, '파일 업로드');
  await dialog.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(sampleFile);
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue('research');
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveAttribute('aria-invalid', 'false');
  await dialog.getByLabel('제목', { exact: true }).fill('직접 정한 제목');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({ ...sampleFile, name: 'another.md' });
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue('직접 정한 제목');
});

test('선택 설명은 접었다 펼쳐도 유지하며 문서와 함께 저장한다', async ({ page }) => {
  const dialog = await openRegistration(page);
  await dialog.getByLabel('제목', { exact: true }).fill('설명을 추가한 문서');
  await dialog.getByLabel('본문', { exact: true }).fill('본문입니다.');
  await dialog.locator('summary').filter({ hasText: '설명 추가' }).click();
  await dialog.getByLabel('설명', { exact: true }).fill('자료 설명입니다.');
  await dialog.locator('summary').filter({ hasText: '설명 접기' }).click();
  await dialog.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await savedDeliverable(page, '설명을 추가한 문서')).description).toBe('자료 설명입니다.');
});

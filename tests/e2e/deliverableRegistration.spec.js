import { test, expect } from '@playwright/test';

async function openRegistration(
  page,
  path = '/preview/spaces/1/teams/1/deliverables',
) {
  await page.addInitScript(() =>
    localStorage.setItem('fairplay:preview-role', 'leader'),
  );
  await page.goto(path);
  if (path.includes('/tasks/'))
    await page.getByRole('tab', { name: '산출물', exact: true }).click();
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '산출물 등록', exact: true });
  await expect(
    dialog.getByRole('button', { name: '문서 작성', exact: true }),
  ).toBeVisible();
  await expect(dialog).not.toContainText(
    '직접 문서를 작성하거나 준비한 파일을 업로드하세요.',
  );
  return dialog;
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
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 640 },
  { width: 800, height: 500 },
]) {
  test(`등록 유형 선택·문서·파일은 같은 고정 모달 크기를 유지한다 ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const requests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/'))
        requests.push(request.url());
    });
    const dialog = await openRegistration(page);
    const initial = await dialog.boundingBox();
    expect(initial.width).toBeLessThanOrEqual(960);
    expect(initial.height).toBeLessThanOrEqual(640);
    expect(initial.x).toBeGreaterThanOrEqual(0);
    expect(initial.y).toBeGreaterThanOrEqual(0);
    await expect(
      dialog.getByRole('button', { name: '문서 작성', exact: true }),
    ).toBeInViewport();
    await expect(
      dialog.getByRole('button', { name: '파일 업로드', exact: true }),
    ).toBeInViewport();
    await expect(dialog.getByLabel('제목', { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: '저장', exact: true }),
    ).toHaveCount(0);
    if (viewport.width === 1440)
      await dialog.screenshot({
        path: testInfo.outputPath('registration-choice.png'),
      });
    for (const type of ['문서 작성', '파일 업로드']) {
      await dialog.getByRole('button', { name: type, exact: true }).click();
      await expect(dialog.getByLabel('제목', { exact: true })).toBeFocused();
      await expect(dialog.getByLabel('자료 유형', { exact: true })).toHaveCount(
        0,
      );
      const box = await dialog.boundingBox();
      expect(Math.abs(box.width - initial.width)).toBeLessThan(1);
      expect(Math.abs(box.height - initial.height)).toBeLessThan(1);
      expect(Math.abs(box.x - initial.x)).toBeLessThan(1);
      expect(Math.abs(box.y - initial.y)).toBeLessThan(1);
      await expect(
        dialog.getByRole('button', { name: '닫기', exact: true }),
      ).toBeInViewport();
      await expect(
        dialog.getByRole('button', { name: '취소', exact: true }),
      ).toBeInViewport();
      await expect(
        dialog.getByRole('button', { name: '저장', exact: true }),
      ).toBeInViewport();
      await expect(
        dialog.getByLabel(type === '문서 작성' ? '본문' : '파일', {
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(
        dialog.getByLabel(type === '문서 작성' ? '파일' : '본문', {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if ([1440, 390].includes(viewport.width))
        await dialog.screenshot({ path: testInfo.outputPath(`${type}.png`) });
      await dialog.getByRole('button', { name: '이전', exact: true }).click();
    }
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toEqual([]);
  });
}

test('유형을 다시 선택해도 초안과 파일을 보존하며 파일 저장에 문서 본문을 섞지 않는다', async ({
  page,
}) => {
  const dialog = await openRegistration(page);
  await dialog
    .getByRole('button', { name: '파일 업로드', exact: true })
    .click();
  await dialog
    .getByLabel('제목', { exact: true })
    .fill('유형 이동 후 파일 저장');
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(sampleFile);
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue(
    '유형 이동 후 파일 저장',
  );
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('유형을 바꿔도 남아 있어야 하는 문서 초안입니다.');
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await dialog
    .getByRole('button', { name: '파일 업로드', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toContainText('research.md');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
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
  await dialog
    .getByRole('button', { name: '파일 업로드', exact: true })
    .click();
  await dialog.getByLabel('파일', { exact: true }).setInputFiles({
    name: 'archive.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('unsupported file draft'),
  });
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await dialog
    .getByLabel('제목', { exact: true })
    .fill('유형 이동 후 문서 저장');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('직접 작성한 문서 본문만 저장합니다.');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedDeliverable(page, '유형 이동 후 문서 저장');
  expect(saved.type).toBe('TEXT');
  expect(saved.text).toBe('직접 작성한 문서 본문만 저장합니다.');
  expect(saved.file).toBeFalsy();
});

test('유형 선택 화면으로 돌아가 취소해도 미저장 보호와 문서 초안을 유지한다', async ({
  page,
}) => {
  const dialog = await openRegistration(page);
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  await dialog.getByLabel('제목', { exact: true }).fill('보존할 문서 제목');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('보존할 문서 내용입니다.');
  await dialog.getByRole('button', { name: '이전', exact: true }).click();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: '입력 내용 버리기',
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '취소', exact: true }).click();
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
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
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  await expect(dialog.getByLabel('작업 연결', { exact: true })).toHaveCount(0);
  await expect(dialog).toContainText('설문 결과 분석');
  await dialog.getByLabel('제목', { exact: true }).fill('작업에 연결한 문서');
  await dialog
    .getByLabel('본문', { exact: true })
    .fill('담당 작업의 분석 결과와 근거를 작성했습니다.');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await savedDeliverable(page, '작업에 연결한 문서')).taskId).toBe(102);
});

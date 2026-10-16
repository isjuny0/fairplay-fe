import { test, expect } from '@playwright/test';

const deliverablesPath = '/preview/spaces/1/teams/1/deliverables';
async function openDeliverables(page, role = 'leader') {
  await page.goto('/preview/main');
  await page.getByLabel('미리보기 역할').selectOption(role);
  await page.goto(deliverablesPath);
  await expect(
    page.getByRole('heading', { name: '산출물 관리', exact: true }),
  ).toBeVisible();
}

test('파일 선택을 해제하면 필수 파일 검증을 유지하고 수정에서는 기존 원본을 보존한다', async ({
  page,
}) => {
  await openDeliverables(page);
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '산출물 등록' });
  await dialog.getByLabel('제목', { exact: true }).fill('공용 설계 파일');
  await dialog.getByLabel('자료 유형', { exact: true }).selectOption('FILE');
  const original = {
    name: 'design.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Design'),
  };
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(original);
  await dialog
    .getByRole('button', { name: '파일 선택 해제', exact: true })
    .click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByLabel('파일', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('파일', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(original);
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: '공용 설계 파일', exact: true }),
    });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '산출물 수정' });
  await expect(
    dialog.getByRole('group', { name: '현재 원본 파일' }),
  ).toContainText('design.md');
  const replacement = dialog.getByLabel('교체할 파일 (선택)', { exact: true });
  await replacement.setInputFiles({
    name: 'replacement.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Replacement'),
  });
  await expect(dialog.getByRole('status')).toContainText('replacement.md');
  await dialog
    .getByRole('button', { name: '파일 선택 해제', exact: true })
    .click();
  await expect(replacement).toHaveValue('');
  await expect(dialog.getByText('replacement.md', { exact: true })).toHaveCount(
    0,
  );
  await dialog.getByLabel('제목', { exact: true }).fill('설계 파일 제목 수정');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  const saved = page
    .getByRole('row')
    .filter({
      has: page.getByRole('button', {
        name: '설계 파일 제목 수정',
        exact: true,
      }),
    });
  await expect(saved).toContainText('design.md');
  await expect(saved).not.toContainText('replacement.md');
});

test('공용 자료의 비작성 부리더는 제목·분류만 수정하고 본문을 유지한다', async ({
  page,
}) => {
  await openDeliverables(page, 'reviewer');
  const row = page
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: '프로젝트 기획서', exact: true }),
    });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '산출물 수정' });
  await expect(
    dialog.getByText('팀 공용 자료의 제목과 분류만 정리할 수 있습니다.', {
      exact: true,
    }),
  ).toBeVisible();
  for (const label of ['설명', '본문', '자료 유형', '작업 연결'])
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole('region', { name: '산출물 내용 입력' }),
  ).toHaveCount(0);
  await dialog.getByLabel('제목', { exact: true }).fill('프로젝트 기획서 정리');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await page
    .getByRole('button', { name: '프로젝트 기획서 정리', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '산출물 상세' })).toContainText(
    '목표: 일상 속 불편을 조사하고 실행 가능한 서비스 개선안을 제안합니다.',
  );
});

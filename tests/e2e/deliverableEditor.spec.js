import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';

const deliverablesPath = '/preview/spaces/1/teams/1/deliverables';
async function openDeliverables(page, role = 'leader') {
  await page.goto('/preview/main');
  await selectPreviewOption(page, '미리보기 역할', role);
  await page.goto(deliverablesPath);
  await expect(
    page.getByRole('heading', { name: '팀 자료', exact: true }),
  ).toBeVisible();
}

test('등록·수정·검색과 상세에서는 분류를 표시하지 않는다', async ({ page }) => {
  await openDeliverables(page);
  await expect(page.getByLabel('산출물 분류', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '유형', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: /^(팀 자료 등록|문서 작성|파일 업로드)$/, exact: true });
  await dialog.getByRole('button', { name: '문서 작성', exact: true }).click();
  await expect(dialog.getByLabel('분류', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Fairplay 프로젝트 소개', exact: true }) });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '팀 자료 수정', exact: true });
  await expect(dialog.getByLabel('분류', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('제목', { exact: true }).fill('Fairplay 프로젝트 소개 수정');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('button', { name: 'Fairplay 프로젝트 소개 수정', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Fairplay 프로젝트 소개 수정', exact: true });
  await expect(dialog.locator('.deliverable-kind')).toHaveText('문서');
});

test('파일 선택을 해제하면 필수 파일 검증을 유지하고 수정에서는 기존 원본을 보존한다', async ({
  page,
}) => {
  await openDeliverables(page);
  await page.getByRole('button', { name: '팀 자료 등록', exact: true }).click();
  await page.getByRole('dialog', { name: /^(팀 자료 등록|문서 작성|파일 업로드)$/, exact: true }).getByRole('button', { name: '파일 업로드', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: /^(팀 자료 등록|문서 작성|파일 업로드)$/, exact: true });
  await dialog.getByLabel('제목', { exact: true }).fill('공용 설계 파일');
  const original = {
    name: 'design.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Design'),
  };
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(original);
  await dialog
    .getByRole('button', { name: '파일 선택 해제', exact: true })
    .click();
  await dialog.getByRole('button', { name: /^(저장|팀 자료 등록)$/, exact: true }).click();
  await expect(dialog.getByLabel('파일', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('파일', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog.getByLabel('파일', { exact: true }).setInputFiles(original);
  await dialog.getByRole('button', { name: /^(저장|팀 자료 등록)$/, exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: '공용 설계 파일', exact: true }),
    });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '팀 자료 수정' });
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
  await dialog.getByRole('button', { name: /^(저장|팀 자료 등록)$/, exact: true }).click();
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

test('공용 자료의 비작성 리더는 제목만 수정하고 본문을 유지한다', async ({
  page,
}) => {
  await openDeliverables(page, 'member');
  await page.getByRole('row').filter({has:page.getByRole('button',{name:'Fairplay 프로젝트 소개',exact:true})}).getByRole('button',{name:'수정',exact:true}).count().then(count=>expect(count).toBe(0));
  await page.evaluate(async () => {const {getMockState, saveMockState} = await import('/src/mock/planned.js'); const {previewContext} = await import('/src/mock/preview.js'); const context=previewContext(); const state=getMockState(context); state.teams[1].deliverables.find(item=>item.taskId==null).authorId=context.user.id; saveMockState(context,state);});
  await openDeliverables(page, 'leader');
  const row = page
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: 'Fairplay 프로젝트 소개', exact: true }),
    });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '팀 자료 수정' });
  await expect(
    dialog.getByText('팀 공용 자료의 제목만 정리할 수 있습니다.', {
      exact: true,
    }),
  ).toBeVisible();
  for (const label of ['설명', '본문', '자료 유형', '작업 연결'])
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole('region', { name: '자료 내용 입력' }),
  ).toHaveCount(0);
  await dialog.getByLabel('제목', { exact: true }).fill('Fairplay 프로젝트 소개 정리');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await page
    .getByRole('button', { name: 'Fairplay 프로젝트 소개 정리', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Fairplay 프로젝트 소개 정리' })).toContainText(
    '목표: 팀 프로젝트의 역할과 수행 과정을 기록하고 기여도를 근거와 함께 확인합니다.',
  );
});

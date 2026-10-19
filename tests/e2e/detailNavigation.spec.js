import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

async function seed(page, role = 'leader') {
  const state = structuredClone(getMockState(previewContext()));
  state.teams[1].tasks.find(task => task.id === 102).description =
    Array.from({ length: 45 }, (_, index) => `${index + 1}. 조사 자료와 분석 결과를 확인합니다.`).join('\n');
  state.teams[1].deliverables.find(item => item.type === 'FILE').description =
    Array.from({ length: 60 }, (_, index) => `${index + 1}. 첨부 자료의 조사 과정과 결과를 설명합니다.`).join('\n');
  await page.addInitScript(({ state, role }) => {
    localStorage.setItem('fairplay:preview-role', role);
    localStorage.setItem('fairplay:mock:v5:preview:1', JSON.stringify(state));
  }, { state, role });
}

for (const width of [1440, 320]) {
  test(`작업 상세 ${width}px: 긴 본문에서 항목 이동·입력 보존·목록 복귀`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await page.goto('/preview/spaces/1/teams/1/tasks?view=list&q=설문&status=IN_PROGRESS');
    await page.getByRole('button', { name: '설문 결과 분석', exact: true }).click();
    const originalUrl = page.url();
    const navigation = page.getByRole('navigation', { name: '작업 상세 항목', exact: true });
    const description = page.getByLabel('내 수행 설명', { exact: true });
    await navigation.getByRole('button', { name: '수행 설명 영역으로 이동', exact: true }).click();
    await expect(page.locator('#task-contributions-section')).toBeFocused();
    await description.fill('아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.');
    for (const [label, id] of [
      ['산출물', 'task-deliverables-section'],
      ['담당·배분', 'task-assignment-section'],
      ['완료 요청 이력', 'task-approval-history'],
      ['작업 설명', 'task-description-section'],
    ]) {
      await navigation.getByRole('button', { name: `${label} 영역으로 이동`, exact: true }).click();
      const target = page.locator(`#${id}`);
      await expect(target).toBeFocused();
      const bar = await page.locator('.task-detail-navigation').boundingBox();
      const section = await target.boundingBox();
      expect(section.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      await expect(page.getByRole('button', { name: '← 목록으로', exact: true })).toBeInViewport();
    }
    await expect(page.locator('#task-approval-history')).toHaveAttribute('open', '');
    await expect(page.getByText('완료 요청 이력이 없습니다.', { exact: true })).toBeVisible();
    expect(page.url()).toBe(originalUrl);
    await expect(description).toHaveValue('아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
    await confirmation.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(description).toHaveValue('아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.');
    await description.fill('조사 자료를 정리하고 주요 발견과 개선안을 검토했습니다.');
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
    expect(new URL(page.url()).searchParams.get('status')).toBe('IN_PROGRESS');
    expect(new URL(page.url()).searchParams.get('view')).toBe('list');
  });
}

test('비담당 승인자도 항목 이동 후 기존 승인 도구를 사용할 수 있다', async ({ page }) => {
  await seed(page, 'reviewer');
  await page.goto('/preview/spaces/1/teams/1/tasks/103');
  await expect(page.getByLabel('내 수행 설명', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '완료 요청 이력 영역으로 이동', exact: true }).click();
  await expect(page.locator('#task-approval-history')).toBeFocused();
  await expect(page.locator('#task-approval-history')).toContainText('승인 대기');
  await page.getByRole('button', { name: '산출물 영역으로 이동', exact: true }).click();
  await expect(page.locator('#task-deliverables-section')).toBeFocused();
  await expect(page.getByRole('button', { name: '완료 승인', exact: true })).toBeInViewport();
});

test('긴 산출물 상세는 다운로드·닫기와 목록 초점 복귀를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await page.goto('/preview/spaces/1/teams/1/deliverables?taskId=101');
  const title = page.getByRole('button', { name: '인터뷰 결과 기록 파일', exact: true });
  await title.click();
  const dialog = page.getByRole('dialog', { name: '산출물 상세', exact: true });
  const download = dialog.getByRole('button', { name: '파일 다운로드', exact: true });
  await expect(download).toBeInViewport();
  await dialog.locator('.deliverable-record summary').scrollIntoViewIfNeeded();
  await expect(download).toBeInViewport();
  const downloaded = page.waitForEvent('download');
  await download.click();
  expect((await downloaded).suggestedFilename()).toBe('인터뷰-기록.txt');
  await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  await expect(title).toBeFocused();
  await expect(page.getByLabel('작업별 조회')).toHaveValue('101');
});

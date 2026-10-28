import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

async function seed(page, role = 'leader') {
  const state = structuredClone(getMockState(previewContext()));
  state.teams[1].tasks.find((task) => task.id === 102).description = Array.from(
    { length: 45 },
    (_, index) => `${index + 1}. 조사 자료와 분석 결과를 확인합니다.`,
  ).join('\n');
  state.teams[1].deliverables.find((item) => item.type === 'FILE').description =
    Array.from(
      { length: 60 },
      (_, index) => `${index + 1}. 첨부 자료의 조사 과정과 결과를 설명합니다.`,
    ).join('\n');
  await page.addInitScript(
    ({ state, role }) => {
      localStorage.setItem('fairplay:preview-role', role);
      localStorage.setItem('fairplay:mock:v7:preview:1', JSON.stringify(state));
    },
    { state, role },
  );
}

for (const width of [1440, 320]) {
  test(`작업 상세 ${width}px: 긴 본문에서 항목 이동·입력 보존·목록 복귀`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await page.goto(
      '/preview/spaces/1/teams/1/tasks?view=list&q=설문&status=IN_PROGRESS',
    );
    await page
      .getByRole('button', { name: '설문 결과 분석', exact: true })
      .click();
    const originalUrl = page.url();
    const navigation = page.getByRole('tablist', {
      name: '작업 상세 항목',
      exact: true,
    });
    const headerBox = await page.locator('.task-detail-header').boundingBox();
    const backBox = await page
      .getByRole('button', { name: '← 목록으로', exact: true })
      .boundingBox();
    expect(backBox.y + backBox.height).toBeLessThanOrEqual(headerBox.y);
    const navigationBox = await page
      .locator('.task-detail-navigation')
      .boundingBox();
    const contentBox = await page.locator('.task-detail-layout').boundingBox();
    expect(navigationBox.y).toBeGreaterThanOrEqual(
      headerBox.y + headerBox.height,
    );
    expect(contentBox.y).toBeGreaterThanOrEqual(
      navigationBox.y + navigationBox.height,
    );
    await expect(navigation.getByRole('tab')).toHaveCount(4);
    await expect(navigation.getByRole('tab')).toHaveText([
      '작업내용',
      '산출물',
      'AI피드백',
      '수행설명',
    ]);
    await expect(
      navigation.getByRole('tab', { name: '댓글', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('.task-progress-sidebar #task-comments-section'),
    ).toBeVisible();
    await expect(
      navigation.getByRole('tab', { name: '작업내용', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.locator('#task-deliverables-section')).toBeHidden();
    await expect(page.locator('#task-contributions-section')).toBeHidden();
    await expect(
      page.getByRole('region', { name: '담당자와 배분', exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('#task-comments-section')).toHaveCount(1);
    const readiness = page.getByRole('list', { name: '완료 준비 상태' });
    await expect(
      readiness.getByRole('img', { name: '충족', exact: true }),
    ).toHaveCount(3);
    await expect(
      readiness.getByRole('img', { name: '미충족', exact: true }),
    ).toHaveCount(1);
    await readiness.screenshot({
      path: testInfo.outputPath('task-readiness-checklist.png'),
    });
    const description = page.getByLabel('내 수행 설명', { exact: true });
    await navigation
      .getByRole('tab', { name: '수행설명', exact: true })
      .click();
    await expect(
      page.getByRole('tabpanel', { name: '수행설명', exact: true }),
    ).toBeVisible();
    await description.fill(
      '아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.',
    );
    for (const [label, id] of [
      ['산출물', 'task-deliverables-section'],
      ['작업내용', 'task-description-section'],
    ]) {
      await navigation.getByRole('tab', { name: label, exact: true }).click();
      const target = page.locator(`#${id}`);
      await expect(target).toBeVisible();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      const bar = await page.locator('.task-detail-navigation').boundingBox();
      const section = await target.boundingBox();
      expect(section.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      await expect(
        page.getByRole('button', { name: '← 목록으로', exact: true }),
      ).toBeVisible();
    }
    expect(page.url()).toBe(originalUrl);
    await expect(description).toHaveValue(
      '아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    const confirmation = page.getByRole('dialog', {
      name: '저장하지 않은 변경 사항',
      exact: true,
    });
    await confirmation
      .getByRole('button', { name: '계속 작성', exact: true })
      .click();
    await navigation
      .getByRole('tab', { name: '수행설명', exact: true })
      .click();
    await expect(description).toHaveValue(
      '아직 저장하지 않은 분석 수행 내용과 검증 결과입니다.',
    );
    await description.fill(
      '조사 자료를 정리하고 주요 발견과 개선안을 검토했습니다.',
    );
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
    expect(new URL(page.url()).searchParams.get('status')).toBe('IN_PROGRESS');
    expect(new URL(page.url()).searchParams.get('view')).toBe('list');
  });
}

test('상세 탭은 방향키·Home·End로 이동하고 댓글과 수행 설명 초안을 보존한다', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/preview/spaces/1/teams/1/tasks/102');
  const tabs = page.getByRole('tablist', { name: '작업 상세 항목' });
  await tabs
    .getByRole('tab', { name: '작업내용', exact: true })
    .press('ArrowRight');
  await expect(
    tabs.getByRole('tab', { name: '산출물', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('tabpanel', { name: '산출물', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('End');
  await expect(
    tabs.getByRole('tab', { name: '수행설명', exact: true }),
  ).toBeFocused();
  await page
    .getByLabel('댓글 내용', { exact: true })
    .fill('탭을 이동해도 남아야 하는 의견');
  await tabs.getByRole('tab', { name: '수행설명', exact: true }).click();
  await page
    .getByLabel('내 수행 설명', { exact: true })
    .fill('탭을 이동해도 남아야 하는 수행 설명입니다.');
  await tabs.getByRole('tab', { name: '산출물', exact: true }).click();
  await expect(page.getByLabel('댓글 내용', { exact: true })).toHaveValue(
    '탭을 이동해도 남아야 하는 의견',
  );
  await tabs.getByRole('tab', { name: '산출물', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(
    tabs.getByRole('tab', { name: '작업내용', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(
    tabs.getByRole('tab', { name: '수행설명', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'AI 피드백 보기', exact: true })
    .click();
  await expect(
    tabs.getByRole('tab', { name: 'AI피드백', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#task-ai-review-section')).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'AI 검토', exact: true }),
  ).toBeVisible();
  await tabs.getByRole('tab', { name: '수행설명', exact: true }).click();
  await expect(page.getByLabel('내 수행 설명', { exact: true })).toHaveValue(
    '탭을 이동해도 남아야 하는 수행 설명입니다.',
  );
});

test('비담당 팀 리더에게는 AI 탭과 조회 요청을 제공하지 않는다', async ({
  page,
}) => {
  await seed(page);
  const calls = [];
  await page.route('**/api/tasks/*/ai-review', (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  await page.goto('/preview/spaces/1/teams/1/tasks/104');
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(
    page.getByRole('tab', { name: 'AI피드백', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'AI 피드백 보기', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('AI 피드백은 이 작업의 담당자에게만 제공됩니다.'),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('긴 산출물 상세는 다운로드·닫기와 목록 초점 복귀를 유지한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await page.goto('/preview/spaces/1/teams/1/deliverables?taskId=101');
  const title = page.getByRole('button', {
    name: '인터뷰 결과 기록 파일',
    exact: true,
  });
  await title.click();
  const dialog = page.getByRole('dialog', { name: '산출물 상세', exact: true });
  const download = dialog.getByRole('button', {
    name: '파일 다운로드',
    exact: true,
  });
  await expect(download).toBeInViewport();
  await dialog.locator('.deliverable-content-footer').scrollIntoViewIfNeeded();
  await expect(download).toBeInViewport();
  const downloaded = page.waitForEvent('download');
  await download.click();
  expect((await downloaded).suggestedFilename()).toBe('인터뷰-기록.txt');
  await dialog
    .getByRole('button', { name: '닫기', exact: true })
    .last()
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(title).toBeFocused();
  await expect(page.getByLabel('작업별 조회')).toHaveValue('101');
});

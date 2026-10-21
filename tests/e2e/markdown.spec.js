import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

const path = '/preview/spaces/1/teams/1/deliverables';
const sample = '# 조사 결과\n\n일반 문장 첫 줄\n두 번째 줄\n\n## 확인 사항\n\n- **주요 발견**\n- [x] 조사 완료\n- [ ] 추가 검증\n\n> 표본의 범위를 확인하세요.\n\n| 항목 | 결과 |\n| --- | --- |\n| 응답 | 12건 |\n\n```text\nconst result = "완료";\n```\n\n[참고 문서](https://example.com)';

async function open(page, target = path, customize = () => {}) {
  const state = structuredClone(getMockState(previewContext()));
  customize(state);
  await page.addInitScript(state => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v7:preview:1', JSON.stringify(state));
  }, state);
  await page.goto(target);
}

test('마크다운 미리보기·저장·수정·연결 산출물에서 원문과 동일한 서식을 유지한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '산출물 등록', exact: true });
  await dialog.getByLabel('제목', { exact: true }).fill('마크다운 조사 기록');
  await dialog.getByLabel('작업 연결', { exact: true }).selectOption('102');
  const body = dialog.getByRole('textbox', { name: '본문', exact: true });
  await body.fill(sample);
  await page.screenshot({ path: testInfo.outputPath('markdown-writing.png') });
  await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
  const preview = dialog.getByRole('region', { name: '본문 미리보기', exact: true });
  await expect(preview.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
  await expect(preview.getByRole('table')).toContainText('12건');
  await expect(preview.locator('strong')).toHaveText('주요 발견');
  await expect(preview.getByRole('checkbox').first()).toBeChecked();
  await expect(preview.getByRole('checkbox').first()).toBeDisabled();
  expect((await preview.locator('.task-list-item').first().boundingBox()).height).toBeLessThan(34);
  await expect(preview.getByRole('link', { name: '참고 문서' })).toHaveAttribute('rel', 'noopener noreferrer');
  await dialog.getByRole('button', { name: '작성', exact: true }).click();
  await expect(body).toHaveValue(sample);
  await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  const title = page.getByRole('button', { name: '마크다운 조사 기록', exact: true });
  await title.click();
  dialog = page.getByRole('dialog', { name: '산출물 상세', exact: true });
  await expect(dialog.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
  await expect(dialog.getByRole('table')).toContainText('12건');
  await page.screenshot({ path: testInfo.outputPath('markdown-detail.png') });
  await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
  const row = page.getByRole('row').filter({ has: title });
  await row.getByRole('button', { name: '수정', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '산출물 수정', exact: true });
  await expect(dialog.getByRole('textbox', { name: '본문', exact: true })).toHaveValue(sample);
  await dialog.getByRole('textbox', { name: '본문', exact: true }).fill(`${sample}\n\n수정한 원문`);
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('button', { name: '작업', exact: true }).click();
  await page.getByRole('button', { name: '설문 결과 분석', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '마크다운 조사 기록', exact: true }) });
  await expect(card.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
  const expand = card.getByRole('button', { name: '본문 더 보기', exact: true });
  if (await expand.isVisible()) await expand.click();
  await expect(card.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
  await expect(card).toContainText('수정한 원문');
});

test('서식 버튼은 선택 영역·초점을 유지하고 입력 길이 및 미저장 보호를 따른다', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '산출물 등록', exact: true });
  const body = dialog.getByRole('textbox', { name: '본문', exact: true });
  await body.fill('중요한 발견');
  await body.focus();
  await body.press('ControlOrMeta+A');
  await dialog.getByRole('button', { name: '굵게 서식 삽입', exact: true }).click();
  await expect(body).toHaveValue('**중요한 발견**');
  await expect(body).toBeFocused();
  for (const [label, expected] of [
    ['제목', '## 내용'], ['목록', '- 내용'], ['번호 목록', '1. 내용'],
    ['체크리스트', '- [ ] 내용'], ['인용', '> 내용'],
    ['링크', '[내용](https://example.com)'],
    ['코드', '```text\n내용\n```\n'],
  ]) {
    await body.fill('내용');
    await body.focus();
    await body.press('ControlOrMeta+A');
    await dialog.getByRole('button', { name: `${label} 서식 삽입`, exact: true }).click();
    await expect(body).toHaveValue(expected);
    await expect(body).toBeFocused();
  }
  await body.fill('');
  await dialog.getByRole('button', { name: '표 서식 삽입', exact: true }).click();
  await expect(body).toHaveValue('| 항목 | 내용 |\n| --- | --- |\n| 항목 1 | 내용 1 |\n');
  await body.fill('가'.repeat(20000));
  await body.press('End');
  await dialog.getByRole('button', { name: '굵게 서식 삽입', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('20,000자를 초과');
  await expect(body).toHaveValue('가'.repeat(20000));
  await page.keyboard.press('Escape');
  const confirmation = page.getByRole('dialog', { name: '입력 내용 버리기', exact: true });
  await confirmation.getByRole('button', { name: '취소', exact: true }).click();
  await expect(body).toHaveValue('가'.repeat(20000));
});

test('빈 본문을 미리보기에서 저장하면 작성 화면의 본문 입력에 오류와 초점을 제공한다', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '산출물 등록', exact: true });
  await dialog.getByLabel('제목', { exact: true }).fill('입력 검증');
  await dialog.getByRole('button', { name: '미리보기', exact: true }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  const body = dialog.getByRole('textbox', { name: '본문', exact: true });
  await expect(body).toBeFocused();
  await expect(body).toHaveAttribute('aria-invalid', 'true');
  await body.fill('필수 본문을 작성했습니다.');
  await expect(dialog.getByRole('button', { name: '미리보기', exact: true })).toBeEnabled();
});

for (const width of [1440, 320]) {
  test(`문서 표시 ${width}px: HTML·이미지·위험 링크 차단과 긴 표·코드 스크롤`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const malicious = '<script>window.markdownExecuted=true</script>\n\n<img src="https://example.com/raw.png" onerror="alert(1)">\n\n![이미지](https://example.com/image.png)\n\n[실행](javascript:alert%281%29)\n\n[데이터](data:text/html,test)\n\n<iframe src="https://example.com"></iframe>';
    const wideContent = `\n\n| ${'긴열'.repeat(40)} | 결과 |\n| --- | --- |\n| ${'내용'.repeat(40)} | 확인 |\n\n\`\`\`text\n${'long_code_'.repeat(80)}\n\`\`\``;
    const requests = [];
    page.on('request', request => { if (request.url().startsWith('https://example.com')) requests.push(request.url()); });
    await open(page, path, state => { state.teams[1].deliverables[0].text = `${sample}\n\n${malicious}${wideContent}`; });
    await page.getByRole('button', { name: '프로젝트 기획서', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '산출물 상세', exact: true });
    await expect(dialog.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
    await expect(dialog.locator('script, img, iframe')).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: '실행', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: '데이터', exact: true })).toHaveCount(0);
    await expect(dialog.getByText('실행', { exact: true })).toBeVisible();
    expect(requests).toEqual([]);
    for (const selector of ['.markdown-table-scroll', '.markdown-body pre']) {
      const scroller = dialog.locator(selector).last();
      await scroller.scrollIntoViewIfNeeded();
      expect(await scroller.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    }
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
    await page.getByRole('button', { name: '산출물 등록', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '산출물 등록', exact: true });
    await editor.getByLabel('제목', { exact: true }).fill('조사 결과 기록');
    await editor.getByRole('textbox', { name: '본문', exact: true }).fill(sample);
    await editor.getByRole('button', { name: '미리보기', exact: true }).click();
    await expect(editor.getByRole('heading', { name: '조사 결과', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('markdown-preview.png') });
  });
}

import { test, expect } from '@playwright/test';

async function openPreview(page, path, role = 'leader', scenario = 'active') {
  await page.goto('/preview/main');
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByText('미리보기 설정', { exact: true }).click();
  await page.getByLabel('미리보기 역할').selectOption(role);
  if (scenario !== 'active')
    await page.getByLabel('미리보기 상황').selectOption(scenario);
  await page.goto(`/preview${path}`);
}

async function fillEvaluation(page, member, score = 4) {
  for (const criterion of ['작업 수행', '책임감', '협업', '의사소통'])
    await page
      .getByLabel(`${member} ${criterion} ${score}점`, { exact: true })
      .check();
}

const peerPath = '/spaces/1/teams/1/peer-evaluations';

test('저장 후 바꾼 평가는 제출을 막고 다시 저장한 최신 점수만 제출한다', async ({
  page,
}) => {
  await openPreview(page, peerPath);
  for (const member of ['이지원', '박서연']) {
    await fillEvaluation(page, member);
    await page
      .getByRole('button', { name: `${member} 평가 저장`, exact: true })
      .click();
  }
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeEnabled();
  await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
  await expect(page.getByText('미저장 변경', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '이지원 평가 저장', exact: true })
    .click();
  await page.getByRole('button', { name: '최종 제출', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '제출 확정', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '최종 제출 완료' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeDisabled();
});

test('미저장 평가의 메뉴 이동과 브라우저 뒤로가기를 취소하면 입력을 유지한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  await page.getByRole('button', { name: '동료 평가', exact: true }).click();
  await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('저장하지 않은 입력');
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeChecked();
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('저장하지 않은 입력');
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await expect(page).toHaveURL(/peer-evaluations$/);
  await page
    .getByRole('button', { name: '중간 평가 마감', exact: true })
    .click();
  await page
    .getByRole('button', { name: '변경 사항 버리고 이동', exact: true })
    .click();
  await expect(page).toHaveURL(/roundId=11$/);
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeDisabled();
});

test('작업 입력창의 Escape와 취소는 미저장 내용을 확인하고 입력을 보존한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const taskDialog = page.getByRole('dialog', { name: '새 작업 만들기' });
  await taskDialog
    .getByLabel('작업 제목', { exact: true })
    .fill('입력 보존 확인');
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: '입력 내용 버리기' })
    .getByRole('button', { name: '취소', exact: true })
    .click();
  await expect(taskDialog.getByLabel('작업 제목', { exact: true })).toHaveValue(
    '입력 보존 확인',
  );
  await taskDialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '버리고 닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('모바일 대상 전환과 다른 대상 저장에도 미저장 점수를 보존한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, '/spaces/1/teams/1');
  await expect(page.getByLabel('미리보기 역할')).toBeHidden();
  await expect(
    page.getByRole('navigation', { name: '팀 메뉴', exact: true }),
  ).toBeHidden();
  await page.getByText('더보기 ⌄', { exact: true }).click();
  await page.getByRole('button', { name: '동료 평가', exact: true }).click();
  await fillEvaluation(page, '이지원');
  await page
    .getByRole('button', { name: '이지원 평가 저장', exact: true })
    .click();
  await page.getByLabel('이지원 작업 수행 5점', { exact: true }).check();
  await page
    .getByRole('button', { name: '박서연 작성 필요', exact: true })
    .click();
  await fillEvaluation(page, '박서연');
  await page
    .getByRole('button', { name: '박서연 평가 저장', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '이지원 미저장', exact: true })
    .click();
  await expect(
    page.getByLabel('이지원 작업 수행 5점', { exact: true }),
  ).toBeChecked();
  await page
    .getByRole('button', { name: '이지원 평가 저장', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '최종 제출', exact: true }),
  ).toBeEnabled();
});

for (const height of [844, 500])
  test(`390×${height} 작업 입력창은 스크롤 전후 저장 버튼과 입력 초점이 가려지지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height });
    await openPreview(page, '/spaces/1/teams/1/tasks');
    await page
      .getByRole('button', { name: '새 작업 만들기', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    const save = dialog.getByRole('button', { name: '저장', exact: true });
    const initialBox = await save.boundingBox();
    expect(initialBox.y + initialBox.height).toBeLessThanOrEqual(height);
    await dialog
      .getByLabel('완료 승인자', { exact: true })
      .scrollIntoViewIfNeeded();
    await dialog.getByLabel('완료 승인자', { exact: true }).focus();
    const inputBox = await dialog
      .getByLabel('완료 승인자', { exact: true })
      .boundingBox();
    const saveBox = await save.boundingBox();
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(saveBox.y);
    expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(height);
  });

test('세 담당자 균등 배분과 필수 승인자 선택으로 작업을 생성한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1/tasks');
  await page
    .getByRole('button', { name: '새 작업 만들기', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('작업 제목', { exact: true }).fill('균등 배분 작업');
  await dialog
    .getByLabel('작업 설명', { exact: true })
    .fill('모든 담당자의 역할과 결과를 함께 확인합니다.');
  await dialog
    .getByLabel('마감 (한국 시간)', { exact: true })
    .fill('2030-12-01T18:00');
  for (const member of ['김하늘 · 리더', '이지원 · 팀원', '박서연 · 부리더'])
    await dialog.getByLabel(member, { exact: true }).check();
  await dialog.getByRole('button', { name: '균등 배분', exact: true }).click();
  await expect(dialog.getByLabel('김하늘 배분율')).toHaveValue('34');
  await expect(dialog.getByLabel('이지원 배분율')).toHaveValue('33');
  await expect(dialog.getByLabel('박서연 배분율')).toHaveValue('33');
  await expect(dialog.getByLabel('완료 승인자', { exact: true })).toHaveValue(
    '',
  );
  await dialog
    .getByLabel('완료 승인자', { exact: true })
    .selectOption({ index: 2 });
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '균등 배분 작업', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('모바일 관리자 카드는 표 가로 스크롤 없이 수행 상세를 연다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, '/spaces/1/dashboard', 'manager');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page
    .getByRole('button', { name: '김하늘 수행 상세', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '김하늘님의 수행 상세', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('조회할 작업 상태').selectOption('PENDING_APPROVAL');
  await expect(
    page.getByRole('heading', { name: '서비스 흐름 설계', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '사용자 인터뷰 계획', exact: true }),
  ).toHaveCount(0);
});

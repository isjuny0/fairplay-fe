export async function selectPreviewOption(page, label, value) {
  const control = page.getByLabel(label, { exact: true });
  if (!(await control.isVisible())) {
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  }
  if (label === '미리보기 역할' && ['member', 'teammate'].includes(value)) {
    if ((await control.inputValue()) !== 'member') await control.selectOption('member');
    const teammate = page.getByLabel('미리보기 팀원', { exact: true });
    if ((await teammate.inputValue()) !== value) await teammate.selectOption(value);
    return;
  }
  if ((await control.inputValue()) === value) return;
  await control.selectOption(value);
  if (label === '미리보기 상황') {
    await page.getByRole('dialog', { name: '미리보기 상황 변경' })
      .getByRole('button', { name: '상황 변경', exact: true }).click();
  }
}

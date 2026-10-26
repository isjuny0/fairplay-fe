export async function selectPreviewOption(page, label, value) {
  const control = page.getByLabel(label, { exact: true });
  if (!(await control.isVisible())) {
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  }
  await control.selectOption(value);
}

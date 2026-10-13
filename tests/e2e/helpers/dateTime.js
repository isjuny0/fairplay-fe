export async function fillDateTime(scope, label, value) {
  const [date, time] = value.split('T');
  await scope
    .getByRole('textbox', { name: `${label} 날짜`, exact: true })
    .fill(date);
  await scope.getByLabel(`${label} 시간`, { exact: true }).fill(time);
}

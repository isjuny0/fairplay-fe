export function collectFieldErrors(form, extraErrors = {}) {
  const errors = {};
  for (const field of form.elements) {
    if (!field.name || !field.willValidate) continue;
    const name = field.dataset.validationName || field.name;
    const label =
      field.getAttribute('aria-label') ||
      field
        .getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .filter(Boolean)
        .join(' ') ||
      '이 항목';
    if (field.validity.valueMissing || (field.required && !field.value.trim()))
      errors[name] = `${label}을 입력해 주세요.`;
    else if (
      field.validity.rangeUnderflow ||
      field.validity.rangeOverflow ||
      field.validity.stepMismatch
    )
      errors[name] = `${field.min}~${field.max} 범위의 정수로 입력해 주세요.`;
    else if (field.validity.customError) errors[name] = field.validationMessage;
    else if (!field.validity.valid)
      errors[name] = `${label} 형식을 확인해 주세요.`;
  }
  return { ...errors, ...extraErrors };
}

export function focusFirstFieldError(form, errors) {
  const firstInvalidField = [...form.elements].find(
    (field) =>
      !field.disabled && errors[field.dataset.validationName || field.name],
  );
  if (firstInvalidField)
    requestAnimationFrame(() => {
      firstInvalidField.focus();
      firstInvalidField.scrollIntoView({ block: 'center' });
    });
}

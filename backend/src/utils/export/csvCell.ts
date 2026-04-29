const FORMULA_PREFIX_PATTERN = /^[\t\r ]*[=+\-@]/;

export function sanitizeCsvCell(value: string): string {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`;
  }

  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

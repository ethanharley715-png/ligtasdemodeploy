import { sanitizeCsvCell } from "../csvCell";

describe("sanitizeCsvCell", () => {
  it("prefixes dangerous spreadsheet formula values", () => {
    expect(sanitizeCsvCell("=2+2")).toBe("'=2+2");
    expect(sanitizeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(sanitizeCsvCell("-10+20")).toBe("'-10+20");
    expect(sanitizeCsvCell("@cmd")).toBe("'@cmd");
    expect(sanitizeCsvCell("\t=hidden")).toBe("'\t=hidden");
    expect(sanitizeCsvCell(" =1+1")).toBe("' =1+1");
  });

  it("still escapes quoted values after sanitizing", () => {
    expect(sanitizeCsvCell("normal, value")).toBe("\"normal, value\"");
    expect(sanitizeCsvCell("\"quoted\"")).toBe("\"\"\"quoted\"\"\"");
  });
});

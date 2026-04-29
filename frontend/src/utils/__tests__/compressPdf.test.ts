import { compressPdf } from "../compressPdf";

function createMockFile(size: number): File {
  const data = new Uint8Array(size);
  return new File([data], "test.pdf", { type: "application/pdf" });
}

test("returns same file if under limit", async () => {
  const file = createMockFile(1000);
  const result = await compressPdf(file);

  expect(result.size).toBe(file.size);
});

test("compresses large file", async () => {
  const file = createMockFile(10 * 1024 * 1024);
  const result = await compressPdf(file);

  expect(result.size).toBeLessThan(file.size);
});
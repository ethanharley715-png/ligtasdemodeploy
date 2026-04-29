import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { PassThrough } from "node:stream";

jest.mock("node:fs/promises", () => ({
  mkdtemp: jest.fn(async () => "C:\\temp\\ligtas-pymupdf-123"),
  writeFile: jest.fn(async () => undefined),
  rm: jest.fn(async () => undefined),
}));

jest.mock("node:child_process", () => ({
  spawn: jest.fn(),
}));

import { spawn } from "node:child_process";
import { extractReportTextWithPyMuPdf } from "../pymupdfExtractor";

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function makeChildProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    stdout,
    stderr,
    once(event: string, listener: (...args: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
}

describe("extractReportTextWithPyMuPdf", () => {
  beforeEach(() => {
    mockedSpawn.mockReset();
  });

  it("maps extractor JSON into the shared extracted report shape", async () => {
    const child = makeChildProcess();
    mockedSpawn.mockImplementation(() => {
      setImmediate(() => {
        child.stdout.write(
          JSON.stringify({
            text: "Visit Date\n8th July 2022",
            pages: [
              {
                page_number: 1,
                width: 595,
                height: 842,
                text: "Visit Date\n8th July 2022",
              },
            ],
          }),
        );
        child.emit("close", 0);
      });

      return child as never;
    });

    await expect(
      extractReportTextWithPyMuPdf(Buffer.from("%PDF-1.4\nDummy PDF", "ascii")),
    ).resolves.toEqual({
      text: "Visit Date\n8th July 2022",
      pages: [
        {
          pageNumber: 1,
          text: "Visit Date\n8th July 2022",
          width: 595,
          height: 842,
        },
      ],
    });
  });

  it("raises internal_error when the python extractor exits with an error", async () => {
    const child = makeChildProcess();
    mockedSpawn.mockImplementation(() => {
      setImmediate(() => {
        child.stderr.write("PyMuPDF missing");
        child.emit("close", 1);
      });

      return child as never;
    });

    await expect(
      extractReportTextWithPyMuPdf(Buffer.from("%PDF-1.4\nDummy PDF", "ascii")),
    ).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });
  });
});

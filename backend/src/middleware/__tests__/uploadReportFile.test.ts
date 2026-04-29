import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import * as fs from "fs";
import { exec } from "child_process";


jest.mock("child_process", () => ({
  exec: jest.fn(),
}));


jest.mock("fs", () => ({
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
}));

describe("compressPdf", () => {
  const samplePath = "input.pdf";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("compresses PDF successfully when Ghostscript runs", async () => {
    
    (exec as unknown as jest.Mock).mockImplementation((_cmd: any, cb: any) => {
      cb(null, "", "");
    });

    const { compressPdf } = await import("../../utils/pdf/compressPdf");

    const result = await compressPdf(samplePath);

    
    expect(result).toBe(samplePath);

    expect(fs.unlinkSync).toHaveBeenCalledWith(samplePath);
    expect(fs.renameSync).toHaveBeenCalled();
  });

  it("returns original file if compression fails", async () => {
    
    (exec as unknown as jest.Mock).mockImplementation((_cmd: any, cb: any) => {
      cb(new Error("Ghostscript failed"), "", "");
    });

    const { compressPdf } = await import("../../utils/pdf/compressPdf");

    const result = await compressPdf(samplePath);

    expect(result).toBe(samplePath);
  });

  it("handles file cleanup errors gracefully", async () => {
    
    (exec as unknown as jest.Mock).mockImplementation((_cmd: any, cb: any) => {
      cb(null, "", "");
    });

    
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {
      throw new Error("cleanup error");
    });

    const { compressPdf } = await import("../../utils/pdf/compressPdf");

    const result = await compressPdf(samplePath);

    expect(result).toBe(samplePath);
  });
});
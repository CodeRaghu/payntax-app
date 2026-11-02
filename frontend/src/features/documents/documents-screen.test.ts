import { describe, expect, it } from "vitest";

import { checkFile } from "./documents-screen";

const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

describe("checkFile (REQ-DOC-001)", () => {
  it("accepts PDF, JPG and PNG up to 20 MB", () => {
    expect(checkFile(file("w2.pdf", "application/pdf", 1000))).toBeUndefined();
    expect(checkFile(file("w2.png", "image/png", 1000))).toBeUndefined();
    expect(checkFile(file("w2.jpg", "image/jpeg", 1000))).toBeUndefined();
  });

  it("rejects other types, empty and oversized files", () => {
    expect(checkFile(file("w2.docx", "application/msword", 10))).toMatch(/Unsupported/);
    expect(checkFile(file("w2.pdf", "application/pdf", 0))).toMatch(/empty/);
    expect(checkFile(file("big.pdf", "application/pdf", 20 * 1024 * 1024 + 1))).toMatch(/20 MB/);
  });
});

import { formatEmailSubject } from "@/lib/format";

describe("formatEmailSubject", () => {
  it("returns the subject trimmed", () => {
    expect(formatEmailSubject("  Hello World  ")).toBe("Hello World");
  });

  it("returns \"(no subject)\" for blank strings", () => {
    expect(formatEmailSubject("")).toBe("(no subject)");
    expect(formatEmailSubject("   ")).toBe("(no subject)");
  });
});

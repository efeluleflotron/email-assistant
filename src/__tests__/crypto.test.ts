import { encrypt, decrypt } from "@/lib/crypto";

const TEST_KEY = Buffer.alloc(32, 0x42).toString("base64");

describe("crypto", () => {
  beforeEach(() => {
    process.env.MASTER_ENCRYPTION_KEY = TEST_KEY;
  });

  it("round-trips plaintext", () => {
    const plain = "hello world";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("handles unicode", () => {
    const plain = "olá — 日本語 — 🔐";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    expect(encrypt("same input")).not.toBe(encrypt("same input"));
  });

  it("rejects tampered ciphertext", () => {
    const ct = encrypt("secret");
    const tampered = ct.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects ciphertext encrypted under a different key", () => {
    const ct = encrypt("secret");
    process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(32, 0x99).toString("base64");
    expect(() => decrypt(ct)).toThrow();
  });

  it("throws when the master key is missing", () => {
    delete process.env.MASTER_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/MASTER_ENCRYPTION_KEY/);
  });

  it("throws when the master key is the wrong length", () => {
    process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(16, 0x42).toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});

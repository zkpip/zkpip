import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { zokratesGroth16 } from "../adapters/zokrates-groth16.js";

// Minimal valid-ish ZoKrates-like input
const VALID_INPUT = {
  proofSystem: "groth16",
  framework: "zokrates",
  verificationKey: { vk_alpha_1: "dummy" }, // real VK shape is more complex; adapter treats it as opaque
  proof: {
    a: ["0x1", "0x2"],
    b: [["0x3", "0x4"], ["0x5", "0x6"]],
    c: ["0x7", "0x8"],
  },
  publicInputs: ["0x9", "0xa"],
};

const INVALID_SHAPE = {
  proofSystem: "groth16",
  framework: "zokrates",
  // missing proof/publicInputs
};

describe("adapter: zokrates-groth16", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("canHandle detects zokrates groth16 by markers", () => {
    expect(zokratesGroth16.canHandle(VALID_INPUT)).toBe(true);
  });

  it("verify → ok when provider.verify returns true", async () => {
    vi.doMock("zokrates-js", async () => {
      return {
        initialize: async () => ({
          verify: async () => true,
        }),
      };
    });
    const { zokratesGroth16: fresh } = await import("../adapters/zokrates-groth16.js");
    const res = await fresh.verify(VALID_INPUT);
    expect(res.ok).toBe(true);
    expect(res.adapter).toBe("zokrates-groth16");
  });

  it("verify → verification_failed when provider.verify returns false", async () => {
    vi.doMock("zokrates-js", async () => {
      return {
        initialize: async () => ({
          verify: async () => false,
        }),
      };
    });
    const { zokratesGroth16: fresh } = await import("../adapters/zokrates-groth16.js");
    const res = await fresh.verify(VALID_INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
    expect(res.error).toBe("verification_failed");
    } else {
    throw new Error("Expected verification_failed, got ok:true");
    }
  });

  it("verify → not_implemented when zokrates-js is missing", async () => {
    vi.doMock("zokrates-js", async () => {
      throw new Error("module not found");
    });
    const { zokratesGroth16: fresh } = await import("../adapters/zokrates-groth16.js");
    const res = await fresh.verify(VALID_INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
    expect(res.error).toBe("not_implemented");
    } else {
    throw new Error("Expected not_implemented, got ok:true");
    }
  });

  it("verify → invalid_input when shape missing", async () => {
    const res = await zokratesGroth16.verify(INVALID_SHAPE);
    expect(res.ok).toBe(false);
    if (!res.ok) {
        expect(res.error).toBe("invalid_input");
    }
  });

  it("verify → adapter error when provider.verify throws", async () => {
    vi.doMock("zokrates-js", async () => {
      return {
        initialize: async () => ({
          verify: async () => {
            throw new Error("zokrates internal");
          },
        }),
      };
    });
    const { zokratesGroth16: fresh } = await import("../adapters/zokrates-groth16.js");
    const res = await fresh.verify(VALID_INPUT);

    expect(res.ok).toBe(false);
    if (!res.ok) {
        expect(typeof res.error).toBe("string");
    } else {
        // Should not happen, but makes TS happy and test explicit
        throw new Error("Expected adapter to fail when provider throws");
    }
  });

});
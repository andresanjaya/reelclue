// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readBoundedJson } from "../../src/lib/server/security/body";

describe("readBoundedJson security helper", () => {
  it("parses valid JSON within byte limits", async () => {
    const payload = { actionId: "123e4567-e89b-12d3-a456-426614174000", revision: 1 };
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const parsed = await readBoundedJson<typeof payload>(request);
    expect(parsed).toEqual(payload);
  });

  it("throws 413 when content-length header exceeds limit", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "100000",
      },
      body: JSON.stringify({ a: 1 }),
    });

    await expect(readBoundedJson(request, 1024)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("throws 413 when actual body byte length exceeds limit", async () => {
    const largeString = "x".repeat(2048);
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ large: largeString }),
    });

    await expect(readBoundedJson(request, 1024)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("throws 400 for empty request body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "   ",
    });

    await expect(readBoundedJson(request)).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("throws 400 for malformed JSON", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });

    await expect(readBoundedJson(request)).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });
});

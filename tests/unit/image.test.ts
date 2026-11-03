import { describe, expect, it } from "vitest";
import { inspectImage, isSafeImageSize } from "../../src/lib/image";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("image magic-byte validation", () => {
  it("accepts a real PNG signature and reads its dimensions", () => {
    const image = inspectImage(pngHeader(640, 480));
    expect(image).toEqual({ mime: "image/png", extension: "png", width: 640, height: 480 });
  });

  it("rejects scripts, SVG and mislabelled files", () => {
    expect(inspectImage(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(inspectImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(inspectImage(new TextEncoder().encode("GIF89a"))).toBeNull();
  });

  it("rejects a truncated PNG header", () => {
    expect(inspectImage(pngHeader(10, 10).slice(0, 12))).toBeNull();
  });

  it("caps absurd pixel dimensions", () => {
    expect(isSafeImageSize({ mime: "image/png", extension: "png", width: 5000, height: 5000 })).toBe(false);
    expect(isSafeImageSize({ mime: "image/png", extension: "png", width: 1200, height: 800 })).toBe(true);
    expect(isSafeImageSize({ mime: "image/png", extension: "png", width: null, height: null })).toBe(true);
  });
});

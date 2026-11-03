/**
 * Image validation without a native image library.
 *
 * Workers cannot run sharp, and the blueprint requires validating real bytes
 * rather than trusting a filename or browser MIME. Accept exactly the three
 * raster formats the product needs and read dimensions from their headers.
 */
export type SupportedImage = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  width: number | null;
  height: number | null;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = bytes[offset + 1];
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = readUint16BE(bytes, offset);
    if (length < 2) break;
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof && offset + 7 < bytes.length) {
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const b = bytes;
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    };
  }

  if (chunk === "VP8X") {
    return {
      width: 1 + readUint24LE(bytes, 24),
      height: 1 + readUint24LE(bytes, 27),
    };
  }

  return null;
}

export function inspectImage(bytes: Uint8Array): SupportedImage | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    if (bytes.length < 24) return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    return {
      mime: "image/png",
      extension: "png",
      width: width > 0 ? width : null,
      height: height > 0 ? height : null,
    };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const dimensions = jpegDimensions(bytes);
    return {
      mime: "image/jpeg",
      extension: "jpg",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    const dimensions = webpDimensions(bytes);
    return {
      mime: "image/webp",
      extension: "webp",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }

  return null;
}

export function isSafeImageSize(image: SupportedImage, maxPixels = 16_000_000): boolean {
  if (!image.width || !image.height) return true;
  return image.width * image.height <= maxPixels;
}

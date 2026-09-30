"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.base64ToUint8Array = base64ToUint8Array;
exports.uint8ArrayToBase64 = uint8ArrayToBase64;
const Buffer = global.Buffer || require('safe-buffer').Buffer;

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(buffer) {
  const buf = Buffer.from(buffer);
  return buf.toString('base64');
}
//# sourceMappingURL=common.js.map
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function sha256File(filePath) {
  return sha256Bytes(await fs.readFile(filePath));
}

export function sha256Combined(inputs) {
  const hash = createHash('sha256');
  for (const { label, bytes } of inputs) {
    const labelBytes = Buffer.from(label, 'utf8');
    const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const lengths = Buffer.allocUnsafe(16);
    lengths.writeBigUInt64BE(BigInt(labelBytes.length), 0);
    lengths.writeBigUInt64BE(BigInt(content.length), 8);
    hash.update(lengths).update(labelBytes).update(content);
  }
  return hash.digest('hex');
}

export function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

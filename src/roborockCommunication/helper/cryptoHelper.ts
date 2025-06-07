import crypto, { CipherKey, BinaryLike } from 'node:crypto';

export function md5bin(str: BinaryLike): Buffer {
  return crypto.createHash('md5').update(str).digest();
}

export function md5hex(str: BinaryLike): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

export function decryptECB(encrypted: string, aesKey: CipherKey) {
  const decipher = crypto.createDecipheriv('aes-128-ecb', aesKey, null);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(encrypted, 'binary', 'utf8');
  decrypted += decipher.final('utf8');
  return removePadding(decrypted);
}

function removePadding(str: string) {
  const paddingLength = str.charCodeAt(str.length - 1);
  return str.slice(0, -paddingLength);
}

// MessageUtils as plain exports
export const SALT = 'TXdfu$jyZ#TZHsg4';

export function encodeTimestamp(timestamp: number) {
  const hex = timestamp.toString(16).padStart(8, '0').split('');
  return [5, 6, 3, 7, 1, 2, 0, 4].map((idx) => hex[idx]).join('');
}

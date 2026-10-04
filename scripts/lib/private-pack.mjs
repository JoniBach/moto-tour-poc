// The private pack's file format, shared by private-pack.mjs and private-unpack.mjs:
//   "GTRPACK1" | salt (16) | iv (12) | AES-256-GCM ciphertext of a .tar.gz | auth tag (16)
import crypto from 'node:crypto';

export const HEADER = Buffer.from('GTRPACK1');
export const SALT = 16;
export const IV = 12;
export const TAG = 16;

/** The key from the password: scrypt, slow on purpose so guessing passwords is expensive. */
export const keyFrom = (password, salt) => crypto.scryptSync(password, salt, 32, { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });

/** The system's own tar (bsdtar on both Windows 10+ and macOS), so both ends read the same format. */
export const tarCommand = () => (process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar');

import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { useEnv } from './env'

// Constant-time string comparison (for the APP_PASSWORD check).
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// AES-256-GCM at-rest encryption for the OAuth refresh token. The 32-byte key
// is derived from APP_ENCRYPTION_KEY via scrypt with a fixed app salt. Output
// packs nonce(12) | tag(16) | ciphertext into one base64 string.
const SALT = 'youtube-search:token-encryption:v1'
const NONCE_BYTES = 12
const TAG_BYTES = 16

let key: Buffer | null = null

function getKey(): Buffer {
  if (!key) key = scryptSync(useEnv().APP_ENCRYPTION_KEY, SALT, 32)
  return key
}

export function encryptSecret(plaintext: string): string {
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv('aes-256-gcm', getKey(), nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([nonce, tag, ciphertext]).toString('base64')
}

export function decryptSecret(packed: string): string {
  const buf = Buffer.from(packed, 'base64')
  const nonce = buf.subarray(0, NONCE_BYTES)
  const tag = buf.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(NONCE_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

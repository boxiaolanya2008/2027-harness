import { safeStorage } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SECRETS_FILE = join(process.env.APPDATA || '.', 'super-agent', 'secrets.json')

type SecretKey = 'aiKey' | 'githubToken'

function load(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(SECRETS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function save(data: Record<string, string>) {
  mkdirSync(join(process.env.APPDATA || '.', 'super-agent'), { recursive: true })
  writeFileSync(SECRETS_FILE, JSON.stringify(data), 'utf-8')
}

// 用 OS keychain 加密后落盘，明文不进 localStorage
export function setSecret(key: SecretKey, value: string) {
  const data = load()
  if (value) {
    data[key] = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value).toString('base64')
      : Buffer.from(value, 'utf-8').toString('base64')
  } else {
    delete data[key]
  }
  save(data)
}

export function getSecret(key: SecretKey): string {
  const raw = load()[key]
  if (!raw) return ''
  try {
    const buf = Buffer.from(raw, 'base64')
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf-8')
  } catch {
    return ''
  }
}

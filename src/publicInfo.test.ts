// 公開リポジトリなので、個人の環境の情報（ユーザーのホームのパスなど）が混ざっていないことを確かめる
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const skipDirs = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report'])
const skipExt = /\.(png|jpg|jpeg|gif|ico|woff2?|zip|pdf)$/i

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return skipDirs.has(name) ? [] : files(p)
    return skipExt.test(name) || name === 'package-lock.json' ? [] : [p]
  })
}

describe('公開情報のチェック', () => {
  // 文字列を分けて書くのは、このファイル自体が引っかからないようにするため
  const patterns: [string, RegExp][] = [
    ['Windows のユーザーフォルダ', new RegExp(['C:', '\\\\', 'Users', '\\\\'].join(''), 'i')],
    ['Mac/Linux のホーム', new RegExp(['/', 'Users/[a-z]'].join(''))],
    ['同期フォルダの名前', new RegExp(['マイ', 'ドライブ'].join(''))],
  ]
  for (const file of files(root)) {
    it(relative(root, file), () => {
      const text = readFileSync(file, 'utf8')
      for (const [label, re] of patterns) expect(re.test(text), label).toBe(false)
    })
  }
})

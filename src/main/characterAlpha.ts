import { readFileSync, writeFileSync } from 'fs'
import { PNG } from 'pngjs'

export const ALPHA_THRESHOLD = 10
const MAGIC = Buffer.from('ALPH')
const MAX_SIZE = 4096

export interface PngInfo {
  width: number
  height: number
  alphaMap: Uint8Array
}

export function readPngInfo(filePath: string): PngInfo {
  const buffer = readFileSync(filePath)
  const png = PNG.sync.read(buffer)
  const { width, height, data } = png

  if (!width || !height) {
    throw new Error('文件不是有效的 PNG 图片')
  }
  if (width > MAX_SIZE || height > MAX_SIZE) {
    throw new Error(`图片尺寸不能超过 ${MAX_SIZE}×${MAX_SIZE}`)
  }

  const alphaMap = new Uint8Array(width * height)
  for (let i = 0; i < alphaMap.length; i++) {
    alphaMap[i] = data[i * 4 + 3]
  }

  return { width, height, alphaMap }
}

export function hasOpaquePixels(alphaMap: Uint8Array, threshold = ALPHA_THRESHOLD): boolean {
  for (let i = 0; i < alphaMap.length; i++) {
    if (alphaMap[i] > threshold) return true
  }
  return false
}

export function writeAlphaBin(
  outputPath: string,
  width: number,
  height: number,
  alphaMap: Uint8Array
): void {
  const header = Buffer.alloc(16)
  MAGIC.copy(header, 0)
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(width, 8)
  header.writeUInt32LE(height, 12)
  writeFileSync(outputPath, Buffer.concat([header, Buffer.from(alphaMap)]))
}

export function buildCharacterMeta(id: string, width: number, height: number): {
  id: string
  width: number
  height: number
  alphaThreshold: number
  files: { base: string; character: string; alpha: string }
} {
  return {
    id,
    width,
    height,
    alphaThreshold: ALPHA_THRESHOLD,
    files: {
      base: 'base.png',
      character: 'character.png',
      alpha: 'alpha.bin'
    }
  }
}

export function writeCharacterMeta(
  outputPath: string,
  id: string,
  width: number,
  height: number
): void {
  const meta = buildCharacterMeta(id, width, height)
  writeFileSync(outputPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')
}

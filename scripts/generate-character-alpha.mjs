/**
 * Generate alpha.bin from a character PNG for usePetHitTest.
 *
 * Usage:
 *   node scripts/generate-character-alpha.mjs <character-folder>
 *   node scripts/generate-character-alpha.mjs theme/themes/hutao
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'

const ALPHA_THRESHOLD = 10
const MAGIC = Buffer.from('ALPH')

function buildAlphaMap(png) {
  const { width, height, data } = png
  const alphaMap = new Uint8Array(width * height)

  for (let i = 0; i < alphaMap.length; i++) {
    alphaMap[i] = data[i * 4 + 3]
  }

  return { width, height, alphaMap }
}

function writeAlphaBin(outputPath, width, height, alphaMap) {
  const header = Buffer.alloc(16)
  MAGIC.copy(header, 0)
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(width, 8)
  header.writeUInt32LE(height, 12)

  writeFileSync(outputPath, Buffer.concat([header, Buffer.from(alphaMap)]))
}

function writeMeta(outputPath, id, width, height) {
  const meta = {
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

  writeFileSync(outputPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

const folder = resolve(process.argv[2] ?? 'theme/themes/hutao')
const characterPath = join(folder, 'character.png')
const alphaPath = join(folder, 'alpha.bin')
const metaPath = join(folder, 'meta.json')
const id = folder.split(/[/\\]/).pop() ?? 'unknown'

if (!existsSync(characterPath)) {
  console.error(`Missing character.png: ${characterPath}`)
  process.exit(1)
}

const buffer = readFileSync(characterPath)
const png = PNG.sync.read(buffer)
const { width, height, alphaMap } = buildAlphaMap(png)

writeAlphaBin(alphaPath, width, height, alphaMap)
writeMeta(metaPath, id, width, height)

const opaquePixels = alphaMap.filter((a) => a > ALPHA_THRESHOLD).length
console.log(`Generated: ${alphaPath}`)
console.log(`Meta: ${metaPath}`)
console.log(`Size: ${width}x${height}, opaque: ${opaquePixels}`)

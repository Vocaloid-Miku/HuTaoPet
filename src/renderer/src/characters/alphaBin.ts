import type { CharacterMeta } from '@shared/character'

export type { CharacterMeta }

export interface CharacterPack {
  id: string
  baseSrc: string
  characterSrc: string
  alphaSrc: string
  meta: CharacterMeta
}

export interface ParsedAlphaBin {
  version: number
  width: number
  height: number
  alphaMap: Uint8Array
}

const MAGIC_BYTES = [0x41, 0x4c, 0x50, 0x48] as const

export function parseAlphaBin(buffer: ArrayBuffer): ParsedAlphaBin {
  if (buffer.byteLength < 16) {
    throw new Error('alpha.bin is too short')
  }

  const view = new DataView(buffer)
  for (let i = 0; i < 4; i++) {
    if (view.getUint8(i) !== MAGIC_BYTES[i]) {
      throw new Error('Invalid alpha.bin magic header')
    }
  }

  const version = view.getUint32(4, true)
  const width = view.getUint32(8, true)
  const height = view.getUint32(12, true)
  const expected = width * height

  if (buffer.byteLength < 16 + expected) {
    throw new Error(
      `alpha.bin size mismatch: expected ${16 + expected} bytes, got ${buffer.byteLength}`
    )
  }

  const alphaMap = new Uint8Array(buffer, 16, expected).slice()

  return { version, width, height, alphaMap }
}

export async function loadAlphaBin(src: string): Promise<ParsedAlphaBin> {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Failed to load alpha.bin: ${src}`)
  }

  return parseAlphaBin(await response.arrayBuffer())
}

import { computed, ref } from 'vue'

const MAX_RECENT = 6

const recentColors = ref<string[]>([
  '#302220',
  '#6e4e4f',
  '#a63b4b',
  '#d4a15b',
  '#eadcc8',
  '#24151e'
])

function normalizeHex(hex: string): string {
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{8}$/.test(value) && value.endsWith('ff')) {
    return value.slice(0, 7)
  }
  return value
}

export function useRecentColors() {
  const presets = computed(() => [
    {
      label: '最近',
      colors: recentColors.value
    }
  ])

  function pushRecent(hex: string): void {
    const next = normalizeHex(hex)
    if (!/^#[0-9a-f]{6,8}$/.test(next)) return
    recentColors.value = [next, ...recentColors.value.filter((c) => c !== next)].slice(
      0,
      MAX_RECENT
    )
  }

  return {
    recentColors,
    presets,
    pushRecent
  }
}

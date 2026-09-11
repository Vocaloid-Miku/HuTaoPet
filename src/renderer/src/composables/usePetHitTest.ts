import { onMounted, onUnmounted, unref, watch, type MaybeRef, type Ref } from 'vue'
import { loadAlphaBin } from '../characters/alphaBin'

const DEFAULT_ALPHA_THRESHOLD = 10
const PRESS_CURSOR_MS = 200

interface UsePetHitTestOptions {
  /** Precomputed alpha.bin URL from theme protocol */
  alphaSrc: MaybeRef<string>
  /** Opacity threshold; defaults to 10 */
  alphaThreshold?: MaybeRef<number>
  /** Cursor when hovering the character */
  hoverCursor?: string
  /** Cursor while pressing on the character */
  activeCursor?: string
  /** Cursor when hovering extra hit targets (e.g. speech box) */
  extraHoverCursor?: string
  /** Extra DOM regions that should capture mouse (e.g. speech box) */
  extraHitTargets?: Array<Ref<HTMLElement | null>> | (() => Array<Ref<HTMLElement | null>>)
  onPetClick?: () => void
  onExtraClick?: () => void
}

function isPointInElement(x: number, y: number, el: HTMLElement | null): boolean {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function getCursorTargets(): HTMLElement[] {
  const targets: HTMLElement[] = [document.documentElement, document.body]
  const app = document.getElementById('app')
  if (app) targets.push(app)

  document
    .querySelectorAll<HTMLElement>(
      '.pet-container, .pet-stage, .pet, .speech-box, .speech-text, .menu-btn'
    )
    .forEach((el) => targets.push(el))

  return targets
}

function setDomCursor(cursor: string): void {
  for (const el of getCursorTargets()) {
    el.style.setProperty('cursor', cursor, 'important')
  }

  const root = document.documentElement
  const previous = root.style.getPropertyValue('cursor')
  root.style.setProperty('cursor', 'none', 'important')
  requestAnimationFrame(() => {
    root.style.setProperty('cursor', previous || cursor, 'important')
    for (const el of getCursorTargets()) {
      el.style.setProperty('cursor', cursor, 'important')
    }
  })
}

type HoverZone = 'none' | 'pet' | 'extra'

export function usePetHitTest(options: UsePetHitTestOptions): void {
  const hoverCursor = options.hoverCursor ?? 'grab'
  const activeCursor = options.activeCursor ?? 'grabbing'
  const extraHoverCursor = options.extraHoverCursor ?? 'pointer'

  function getAlphaThreshold(): number {
    return unref(options.alphaThreshold) ?? DEFAULT_ALPHA_THRESHOLD
  }

  function getExtraHitTargets(): Array<Ref<HTMLElement | null>> {
    const targets = options.extraHitTargets ?? []
    return typeof targets === 'function' ? targets() : targets
  }

  let alphaMap: Uint8Array | null = null
  let imageNaturalWidth = 0
  let imageNaturalHeight = 0
  let hoverZone: HoverZone = 'none'
  let isPressing = false
  let lastX = -1
  let lastY = -1
  let lastAppliedCursor = ''
  let pressCursorTimer: ReturnType<typeof setTimeout> | null = null
  let loadToken = 0

  function clearPressCursorTimer(): void {
    if (!pressCursorTimer) return
    clearTimeout(pressCursorTimer)
    pressCursorTimer = null
  }

  async function applyAlphaSrc(src: string): Promise<void> {
    const token = ++loadToken
    if (!src) {
      alphaMap = null
      imageNaturalWidth = 0
      imageNaturalHeight = 0
      return
    }

    try {
      const parsed = await loadAlphaBin(src)
      if (token !== loadToken) return
      alphaMap = parsed.alphaMap
      imageNaturalWidth = parsed.width
      imageNaturalHeight = parsed.height
      if (lastX >= 0 && lastY >= 0) {
        updateMouseState(lastX, lastY)
      }
    } catch (error) {
      if (token !== loadToken) return
      console.warn('Failed to load alpha.bin:', error)
      alphaMap = null
      imageNaturalWidth = 0
      imageNaturalHeight = 0
    }
  }

  function isOverExtra(x: number, y: number): boolean {
    return getExtraHitTargets().some((target) => isPointInElement(x, y, target.value))
  }

  function isOpaqueAt(x: number, y: number): boolean {
    if (!alphaMap) return false

    const containerWidth = window.innerWidth
    const containerHeight = window.innerHeight

    if (x < 0 || y < 0 || x >= containerWidth || y >= containerHeight) {
      return false
    }

    const imageX = Math.min(
      imageNaturalWidth - 1,
      Math.floor((x / containerWidth) * imageNaturalWidth)
    )
    const imageY = Math.min(
      imageNaturalHeight - 1,
      Math.floor((y / containerHeight) * imageNaturalHeight)
    )

    return alphaMap[imageY * imageNaturalWidth + imageX] > getAlphaThreshold()
  }

  function resolveZone(x: number, y: number): HoverZone {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
      return 'none'
    }
    if (isOverExtra(x, y)) return 'extra'
    if (isOpaqueAt(x, y)) return 'pet'
    return 'none'
  }

  function cursorForZone(zone: HoverZone): string {
    if (zone === 'pet') return isPressing ? activeCursor : hoverCursor
    if (zone === 'extra') return extraHoverCursor
    return 'default'
  }

  function applyCursor(zone: HoverZone, force = false): void {
    const cursor = cursorForZone(zone)
    if (!force && cursor === lastAppliedCursor) return
    lastAppliedCursor = cursor
    setDomCursor(cursor)
  }

  function updateMouseState(x: number, y: number): void {
    if (x === lastX && y === lastY) return
    lastX = x
    lastY = y

    const nextZone = resolveZone(x, y)

    if (nextZone === hoverZone) {
      applyCursor(nextZone)
      return
    }

    const wasInteractive = hoverZone !== 'none'
    const willInteractive = nextZone !== 'none'

    hoverZone = nextZone

    if (willInteractive && !wasInteractive) {
      window.api.setIgnoreMouseEvents(false)
    } else if (!willInteractive && wasInteractive) {
      isPressing = false
      clearPressCursorTimer()
      window.api.setIgnoreMouseEvents(true, true)
    }

    applyCursor(nextZone, true)
  }

  onMounted(() => {
    void applyAlphaSrc(unref(options.alphaSrc))

    const stopWatch = watch(
      () => unref(options.alphaSrc),
      (src) => {
        void applyAlphaSrc(src)
      }
    )

    function handleMouseDown(event: MouseEvent): void {
      const { clientX: x, clientY: y } = event
      if (!isOpaqueAt(x, y) || isOverExtra(x, y)) return

      isPressing = true
      applyCursor('pet', true)
      clearPressCursorTimer()
      pressCursorTimer = setTimeout(() => {
        isPressing = false
        pressCursorTimer = null
        if (hoverZone === 'pet') {
          applyCursor('pet', true)
        }
      }, PRESS_CURSOR_MS)
    }

    function handleClick(event: MouseEvent): void {
      const { clientX: x, clientY: y } = event

      if (isOverExtra(x, y)) {
        if (
          getExtraHitTargets().some(
            (target) =>
              target.value?.classList.contains('menu-btn') && isPointInElement(x, y, target.value)
          )
        ) {
          return
        }
        options.onExtraClick?.()
        return
      }

      if (isOpaqueAt(x, y)) {
        options.onPetClick?.()
      }
    }

    window.api.setIgnoreMouseEvents(true, true)
    window.api.startCursorTracking()
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('click', handleClick)

    const removeCursorListener = window.api.onCursorPosition(({ x, y }) => {
      updateMouseState(x, y)
    })

    onUnmounted(() => {
      stopWatch()
      removeCursorListener()
      clearPressCursorTimer()
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('click', handleClick)
      window.api.stopCursorTracking()
      alphaMap = null
      setDomCursor('default')
    })
  })
}

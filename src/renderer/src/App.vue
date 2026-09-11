<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePetHitTest } from './composables/usePetHitTest'
import { DEFAULT_APPEARANCE, cloneAppearanceConfig, type AppearanceConfig } from '@shared/appearance'

const SQUASH_SCALE = 0.85
const SQUASH_DURATION_MS = 100
const RECOVER_DURATION_MS = 200
const EASING = 'cubic-bezier(0.45, 0, 0.55, 1)'

const petImage = ref('')
const alphaSrc = ref('')
const alphaThreshold = ref(10)

const petRef = ref<HTMLElement | null>(null)
const speechBoxRef = ref<HTMLElement | null>(null)
const menuBtnRef = ref<HTMLElement | null>(null)

const appearance = ref<AppearanceConfig>(cloneAppearanceConfig(DEFAULT_APPEARANCE))
const soundEnabled = ref(true)
const soundVolume = ref(5)
const clickSoundName = ref('橡皮鸭')

const speechHitTargets = computed(() => {
  const targets: Array<typeof speechBoxRef> = [menuBtnRef]
  if (appearance.value.speechVisible) {
    targets.unshift(speechBoxRef)
  }
  return targets
})

const menuBtnStyle = computed(() => ({
  top: `${appearance.value.menuBtnTop}%`,
  right: `${appearance.value.menuBtnRight}%`,
  width: `${appearance.value.menuBtnSize}px`,
  height: `${appearance.value.menuBtnSize}px`,
  '--accent-color': appearance.value.menuBtnIconColor,
  '--text-color': appearance.value.menuBtnBgColor,
  borderColor: appearance.value.menuBtnBorderColor
}))

const speechTextStyle = computed(() => ({
  color: appearance.value.speechColor,
  fontSize: `${appearance.value.speechFontSize}px`
}))

const speechTexts = computed(() => {
  const list = appearance.value.speechTexts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
  return list.length > 0 ? list : DEFAULT_APPEARANCE.speechTexts
})

const speechIndex = ref(0)
const speechText = ref(speechTexts.value[0] ?? '')
const speechAnimating = ref(false)

function syncSpeechText(): void {
  const texts = speechTexts.value
  if (texts.length === 0) {
    speechIndex.value = 0
    speechText.value = ''
    return
  }
  if (speechIndex.value >= texts.length) {
    speechIndex.value = 0
  }
  speechText.value = texts[speechIndex.value] ?? texts[0]
}

watch(speechTexts, () => {
  syncSpeechText()
})

let activeAnimation: Animation | null = null
let bounceToken = 0

let audioContext: AudioContext | null = null
let clickBuffer: AudioBuffer | null = null

async function loadCharacterPack(): Promise<void> {
  const pack = await window.api.getActiveCharacterPack()
  if (!pack) {
    console.warn('Active character pack unavailable')
    petImage.value = ''
    alphaSrc.value = ''
    return
  }

  petImage.value = pack.baseUrl
  alphaSrc.value = pack.alphaUrl
  alphaThreshold.value = pack.meta.alphaThreshold
}

async function preloadClickSound(): Promise<void> {
  const buffer = await window.api.getClickSoundBuffer()
  if (!buffer) {
    console.warn('Click sound buffer unavailable')
    clickBuffer = null
    return
  }

  if (!audioContext) {
    audioContext = new AudioContext()
  }

  clickBuffer = await audioContext.decodeAudioData(buffer.slice(0))
}

function playClickSound(): void {
  if (!soundEnabled.value) return
  if (!audioContext || !clickBuffer) return
  if (soundVolume.value <= 0) return

  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }

  const source = audioContext.createBufferSource()
  const gain = audioContext.createGain()
  gain.gain.value = soundVolume.value / 10
  source.buffer = clickBuffer
  source.connect(gain)
  gain.connect(audioContext.destination)
  source.start(0)
}

function nextSpeechText(): void {
  const texts = speechTexts.value
  if (speechAnimating.value || texts.length === 0) return

  speechAnimating.value = true
  speechIndex.value = (speechIndex.value + 1) % texts.length
  speechText.value = texts[speechIndex.value]
}

function onSpeechFadeDone(): void {
  speechAnimating.value = false
}

function toggleModal(): void {
  window.api.toggleModal()
}

function getCurrentScaleY(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform
  if (!transform || transform === 'none') return 1

  const match = transform.match(/matrix(?:3d)?\((.+)\)/)
  if (!match) return 1

  const values = match[1].split(',').map((value) => Number(value.trim()))
  if (transform.startsWith('matrix3d')) {
    return values[5] ?? 1
  }

  return values[3] ?? 1
}

async function playBounce(): Promise<void> {
  const el = petRef.value
  if (!el) return

  const fromScale = getCurrentScaleY(el)
  const token = ++bounceToken

  activeAnimation?.cancel()
  el.style.transform = `scaleY(${fromScale})`

  const squash = el.animate(
    [{ transform: `scaleY(${fromScale})` }, { transform: `scaleY(${SQUASH_SCALE})` }],
    {
      duration: SQUASH_DURATION_MS,
      easing: EASING,
      fill: 'forwards'
    }
  )
  activeAnimation = squash

  try {
    await squash.finished
  } catch {
    return
  }

  if (token !== bounceToken) return

  el.style.transform = `scaleY(${SQUASH_SCALE})`

  const recover = el.animate(
    [{ transform: `scaleY(${SQUASH_SCALE})` }, { transform: 'scaleY(1)' }],
    {
      duration: RECOVER_DURATION_MS,
      easing: EASING,
      fill: 'forwards'
    }
  )
  activeAnimation = recover

  try {
    await recover.finished
  } catch {
    return
  }

  if (token !== bounceToken) return

  el.style.transform = 'scaleY(1)'
  activeAnimation = null
}

usePetHitTest({
  alphaSrc,
  alphaThreshold,
  hoverCursor: 'grab',
  activeCursor: 'grabbing',
  extraHoverCursor: 'pointer',
  extraHitTargets: () => speechHitTargets.value,
  onPetClick: () => {
    playClickSound()
    void playBounce()
  },
  onExtraClick: () => {
    nextSpeechText()
  }
})

let stopAppearanceListener: (() => void) | undefined
let stopAudioSettingsListener: (() => void) | undefined
let stopThemeListener: (() => void) | undefined

onMounted(() => {
  void loadCharacterPack()
  void preloadClickSound()
  void window.api.getAppearanceConfig().then((config) => {
    appearance.value = config
    syncSpeechText()
  })
  void window.api.getAudioSettings().then((config) => {
    soundEnabled.value = config.soundEnabled
    soundVolume.value = config.soundVolume
    clickSoundName.value = config.clickSoundName
  })
  stopAppearanceListener = window.api.onAppearanceConfigChanged((config) => {
    appearance.value = config
    syncSpeechText()
  })
  stopAudioSettingsListener = window.api.onAudioSettingsChanged((config) => {
    soundEnabled.value = config.soundEnabled
    soundVolume.value = config.soundVolume
    if (config.clickSoundName !== clickSoundName.value) {
      clickSoundName.value = config.clickSoundName
      void preloadClickSound()
    }
  })
  stopThemeListener = window.api.onThemeChanged(() => {
    void loadCharacterPack()
  })
})

onUnmounted(() => {
  stopAppearanceListener?.()
  stopAudioSettingsListener?.()
  stopThemeListener?.()
})
</script>

<template>
  <div class="pet-container">
    <div ref="petRef" class="pet-stage">
      <img class="pet" :src="petImage" alt="desktop pet" draggable="false" />
      <div v-if="appearance.speechVisible" ref="speechBoxRef" class="speech-box">
        <Transition name="speech-fade" mode="out-in" @after-enter="onSpeechFadeDone">
          <span :key="speechIndex" class="speech-text" :style="speechTextStyle">{{ speechText }}</span>
        </Transition>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <button
      ref="menuBtnRef"
      type="button"
      class="menu-btn"
      aria-label="menu"
      :style="menuBtnStyle"
      @click.stop="toggleModal"
    >
      <span class="menu-btn__line"></span>
      <span class="menu-btn__line"></span>
      <span class="menu-btn__line"></span>
    </button>
  </Teleport>
</template>

<style scoped>
.pet-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: transparent;
  -webkit-app-region: no-drag;
}

.pet-stage {
  position: relative;
  width: 100%;
  height: 100%;
  transform: scaleY(1);
  transform-origin: bottom center;
  will-change: transform;
}

.pet {
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  -webkit-user-drag: none;
}

.speech-box {
  position: absolute;
  left: 13%;
  top: 13%;
  width: 36%;
  height: 22%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
}

.speech-text {
  display: block;
  width: 100%;
  text-align: center;
  font-weight: 600;
  line-height: 2.2;
  letter-spacing: 0.05em;
  white-space: nowrap;
  user-select: none;
}

.menu-btn {
  position: fixed;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2.5px solid var(--accent-color);
  border-radius: 4px;
  background-color: var(--text-color);
  cursor: pointer;
  pointer-events: auto;
  z-index: 10;
}

.menu-btn__line {
  display: block;
  width: 55%;
  height: 3px;
  background-color: var(--accent-color);
  border-radius: 1.5px;
}

.speech-fade-enter-active,
.speech-fade-leave-active {
  transition: opacity 0.35s ease;
}

.speech-fade-enter-from,
.speech-fade-leave-to {
  opacity: 0;
}
</style>

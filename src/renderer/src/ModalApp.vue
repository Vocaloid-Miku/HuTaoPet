<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AboutPanel from './components/AboutPanel.vue'
import HutaoColorPicker from './components/HutaoColorPicker.vue'
import SoundPanel from './components/SoundPanel.vue'
import ThemePanel from './components/ThemePanel.vue'
import UnsavedChangesDialog from './components/UnsavedChangesDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import {
  DEFAULT_APPEARANCE,
  SPEECH_TEXT_MAX_LENGTH,
  SPEECH_TEXTS_MAX_COUNT,
  cloneAppearanceConfig,
  validateSpeechTextsForSave,
  type AppearanceConfig
} from '@shared/appearance'
import packageJson from '../../../package.json'

type NavKey = 'system' | 'appearance' | 'sound' | 'theme' | 'about'

interface NavItem {
  key: NavKey
  label: string
}

const navItems: NavItem[] = [
  { key: 'system', label: '系统' },
  { key: 'appearance', label: '外观' },
  { key: 'sound', label: '声音' },
  { key: 'theme', label: '主题' },
  { key: 'about', label: '关于' }
]

const appVersion = packageJson.version

const activeNav = ref<NavKey>('system')
const closing = ref(false)

const settings = reactive({
  autoStart: false
})

const appearanceConfigPath = ref('')
const systemConfigPath = ref('')
const soundFolderPath = ref('')
const soundConfigPath = ref('')
const themeFolderPath = ref('')
let lastAppliedSoundFolderPath = ''
let lastAppliedSoundConfigPath = ''
let lastAppliedThemeFolderPath = ''
let lastAppliedAppearancePath = ''

const appearance = reactive<AppearanceConfig>(cloneAppearanceConfig(DEFAULT_APPEARANCE))
const savedBaseline = ref<AppearanceConfig>(cloneAppearanceConfig(DEFAULT_APPEARANCE))
const speechTextDrafts = ref<string[]>([...DEFAULT_APPEARANCE.speechTexts])
const speechTextsError = ref('')
const unsavedDialogOpen = ref(false)

type AppearanceConfirmAction = 'save' | 'reset' | 'restoreTheme' | 'applyTheme'

const appearanceConfirmAction = ref<AppearanceConfirmAction | null>(null)
const appearanceConfirmOpen = computed(() => appearanceConfirmAction.value !== null)
const appearanceConfirmCopy = computed(() => {
  switch (appearanceConfirmAction.value) {
    case 'save':
      return {
        title: '保存外观',
        message: '是否保存当前外观配置？',
        confirmLabel: '保存'
      }
    case 'reset':
      return {
        title: '重置外观',
        message: '是否重置到上次保存的外观配置？未保存的修改将丢失。',
        confirmLabel: '重置'
      }
    case 'restoreTheme':
      return {
        title: '恢复到主题',
        message: '是否用当前激活主题的外观覆盖现有配置？',
        confirmLabel: '恢复'
      }
    case 'applyTheme':
      return {
        title: '应用到主题',
        message: '是否将当前外观写入当前激活主题，并同时保存外观配置？',
        confirmLabel: '应用'
      }
    default:
      return {
        title: '确认操作',
        message: '是否继续？',
        confirmLabel: '确定'
      }
  }
})

type PendingAction =
  | { type: 'close' }
  | { type: 'nav'; key: NavKey }

let pendingAction: PendingAction | null = null

const appearanceKeys = Object.keys(DEFAULT_APPEARANCE) as (keyof AppearanceConfig)[]

function speechTextsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index])
}

function isAppearanceEqual(a: AppearanceConfig, b: AppearanceConfig): boolean {
  return appearanceKeys.every((key) => {
    if (key === 'speechTexts') {
      return speechTextsEqual(a.speechTexts, b.speechTexts)
    }
    return a[key] === b[key]
  })
}

const appearanceDirty = computed(() => {
  const current = cloneAppearanceConfig(appearance)
  current.speechTexts = [...speechTextDrafts.value]
  return !isAppearanceEqual(current, savedBaseline.value)
})

const activeLabel = computed(
  () => navItems.find((item) => item.key === activeNav.value)?.label ?? '胡桃桌宠'
)

let syncingAppearance = false
let appearanceGeneration = 0
let previewSeq = 0
const appearanceReady = ref(false)
let stopAppearanceListener: (() => void) | undefined
let stopSystemListener: (() => void) | undefined

function applyAppearanceToForm(config: AppearanceConfig): void {
  previewSeq += 1
  syncingAppearance = true
  Object.assign(appearance, cloneAppearanceConfig(config))
  speechTextDrafts.value = [...config.speechTexts]
  speechTextsError.value = ''
  void nextTick(() => {
    syncingAppearance = false
  })
}

function updateSavedBaseline(config: AppearanceConfig): void {
  savedBaseline.value = cloneAppearanceConfig(config)
}

async function loadAppearance(): Promise<void> {
  const [current, saved, generation] = await Promise.all([
    window.api.getAppearanceConfig(),
    window.api.getSavedAppearanceConfig(),
    window.api.getAppearanceGeneration()
  ])
  appearanceGeneration = generation
  updateSavedBaseline(saved)
  applyAppearanceToForm(current)
}

async function previewAppearance(): Promise<void> {
  if (syncingAppearance) return
  const seq = ++previewSeq
  const generation = appearanceGeneration
  const payload = cloneAppearanceConfig({
    ...appearance,
    speechTexts: [...appearance.speechTexts]
  })
  const applied = await window.api.setAppearanceConfig(payload, generation)
  if (seq !== previewSeq || generation !== appearanceGeneration || syncingAppearance) {
    return
  }
  // Keep speech drafts local; only sync style/size fields from preview.
  syncingAppearance = true
  const next = cloneAppearanceConfig(applied)
  next.speechTexts = [...speechTextDrafts.value]
  Object.assign(appearance, next)
  await nextTick()
  syncingAppearance = false
}

function requestAppearanceAction(action: AppearanceConfirmAction): void {
  appearanceConfirmAction.value = action
}

function cancelAppearanceConfirm(): void {
  appearanceConfirmAction.value = null
}

async function confirmAppearanceAction(): Promise<void> {
  const action = appearanceConfirmAction.value
  appearanceConfirmAction.value = null
  if (!action) return

  if (action === 'save') {
    await saveAppearance()
    return
  }
  if (action === 'reset') {
    await resetAppearance()
    return
  }
  if (action === 'restoreTheme') {
    await restoreAppearanceFromTheme()
    return
  }
  if (action === 'applyTheme') {
    await applyAppearanceToTheme()
  }
}

async function saveAppearance(): Promise<void> {
  const error = validateSpeechTextsForSave(speechTextDrafts.value)
  if (error) {
    speechTextsError.value = error
    return
  }
  speechTextsError.value = ''
  const payload = cloneAppearanceConfig({
    ...appearance,
    speechTexts: [...speechTextDrafts.value]
  })
  const saved = await window.api.saveAppearanceConfig(payload)
  appearanceGeneration = await window.api.getAppearanceGeneration()
  applyAppearanceToForm(saved)
  updateSavedBaseline(saved)
}

async function resetAppearance(): Promise<void> {
  const config = await window.api.resetAppearanceConfig()
  applyAppearanceToForm(config)
}

async function restoreAppearanceFromTheme(): Promise<void> {
  try {
    const config = await window.api.restoreAppearanceFromActiveTheme()
    appearanceGeneration = await window.api.getAppearanceGeneration()
    applyAppearanceToForm(config)
    updateSavedBaseline(config)
  } catch (error) {
    console.warn('Failed to restore appearance from active theme:', error)
  }
}

async function applyAppearanceToTheme(): Promise<void> {
  const error = validateSpeechTextsForSave(speechTextDrafts.value)
  if (error) {
    speechTextsError.value = error
    return
  }
  speechTextsError.value = ''
  const payload = cloneAppearanceConfig({
    ...appearance,
    speechTexts: [...speechTextDrafts.value]
  })
  try {
    await window.api.applyAppearanceToActiveTheme(payload)
    const saved = await window.api.saveAppearanceConfig(payload)
    appearanceGeneration = await window.api.getAppearanceGeneration()
    applyAppearanceToForm(saved)
    updateSavedBaseline(saved)
  } catch (err) {
    console.warn('Failed to apply appearance to active theme:', err)
  }
}

function addSpeechText(): void {
  if (speechTextDrafts.value.length >= SPEECH_TEXTS_MAX_COUNT) return
  speechTextsError.value = ''
  speechTextDrafts.value = [...speechTextDrafts.value, '']
}

function removeSpeechText(index: number): void {
  if (speechTextDrafts.value.length <= 1) return
  speechTextsError.value = ''
  speechTextDrafts.value = speechTextDrafts.value.filter((_, i) => i !== index)
}

function onSpeechTextInput(index: number, event: Event): void {
  const target = event.target as HTMLInputElement
  const next = [...speechTextDrafts.value]
  next[index] = target.value
  speechTextDrafts.value = next
  if (speechTextsError.value) speechTextsError.value = ''
}

function runPendingAction(): void {
  if (!pendingAction) return

  if (pendingAction.type === 'close') {
    closeModal()
  } else {
    activeNav.value = pendingAction.key
  }

  pendingAction = null
  unsavedDialogOpen.value = false
}

function clearPendingAction(): void {
  pendingAction = null
  unsavedDialogOpen.value = false
}

function openUnsavedDialog(action: PendingAction): void {
  pendingAction = action
  unsavedDialogOpen.value = true
}

function shouldConfirmAppearanceLeave(): boolean {
  return activeNav.value === 'appearance' && appearanceDirty.value
}

function requestNav(key: NavKey): void {
  if (key === activeNav.value) return

  if (shouldConfirmAppearanceLeave()) {
    openUnsavedDialog({ type: 'nav', key })
    return
  }

  activeNav.value = key
}

function requestClose(): void {
  if (appearanceDirty.value) {
    openUnsavedDialog({ type: 'close' })
    return
  }

  closeModal()
}

async function handleUnsavedSave(): Promise<void> {
  await saveAppearance()
  runPendingAction()
}

async function handleUnsavedDiscard(): Promise<void> {
  await resetAppearance()
  runPendingAction()
}

function handleUnsavedCancel(): void {
  clearPendingAction()
}

watch(
  appearance,
  () => {
    if (!appearanceReady.value || syncingAppearance) return
    void previewAppearance()
  },
  { deep: true }
)

function minimizeModal(): void {
  window.api.minimizeModal()
}

async function loadSystemSettings(): Promise<void> {
  const [system, effectivePath, systemPath, soundPath, soundCfgPath, themePath] = await Promise.all([
    window.api.getSystemConfig(),
    window.api.getAppearanceConfigPath(),
    window.api.getSystemConfigPath(),
    window.api.getSoundFolderPath(),
    window.api.getAudioSettingsPath(),
    window.api.getThemeFolderPath()
  ])
  settings.autoStart = system.autoStart
  systemConfigPath.value = systemPath
  appearanceConfigPath.value = system.appearanceConfigPath || effectivePath
  lastAppliedAppearancePath = appearanceConfigPath.value
  soundFolderPath.value = soundPath
  themeFolderPath.value = themePath
  lastAppliedSoundFolderPath = soundPath
  lastAppliedThemeFolderPath = themePath
  soundConfigPath.value = system.soundConfigPath || soundCfgPath
  lastAppliedSoundConfigPath = soundConfigPath.value
}

let applyingAutoStart = false

async function onAutoStartChange(): Promise<void> {
  if (applyingAutoStart) return
  const next = settings.autoStart
  applyingAutoStart = true
  try {
    const saved = await window.api.setAutoStart(next)
    settings.autoStart = saved.autoStart
  } catch (error) {
    settings.autoStart = !next
    console.warn('Failed to update auto-start:', error)
  } finally {
    applyingAutoStart = false
  }
}

async function loadAppearanceConfigPath(): Promise<void> {
  await loadSystemSettings()
}

async function applyAppearanceConfigPath(): Promise<void> {
  if (appearanceConfigPath.value === lastAppliedAppearancePath) return

  const applied = await window.api.setAppearanceConfigPath(appearanceConfigPath.value)
  appearanceConfigPath.value = applied
  lastAppliedAppearancePath = applied
  const [current, saved] = await Promise.all([
    window.api.getAppearanceConfig(),
    window.api.getSavedAppearanceConfig()
  ])
  updateSavedBaseline(saved)
  applyAppearanceToForm(current)
}

async function pickAppearanceConfigPath(): Promise<void> {
  const picked = await window.api.pickAppearanceConfigFile()
  if (!picked) return
  appearanceConfigPath.value = picked
  await applyAppearanceConfigPath()
}

function onAppearanceConfigPathBlur(): void {
  void applyAppearanceConfigPath()
}

async function applySoundFolderPath(): Promise<void> {
  if (soundFolderPath.value === lastAppliedSoundFolderPath) return
  const applied = await window.api.setSoundFolderPath(soundFolderPath.value)
  soundFolderPath.value = applied
  lastAppliedSoundFolderPath = applied
  const [system, soundCfgPath] = await Promise.all([
    window.api.getSystemConfig(),
    window.api.getAudioSettingsPath()
  ])
  soundConfigPath.value = system.soundConfigPath || soundCfgPath
  lastAppliedSoundConfigPath = soundConfigPath.value
}

async function pickSoundFolderPath(): Promise<void> {
  const picked = await window.api.pickSoundFolder()
  if (!picked) return
  soundFolderPath.value = picked
  await applySoundFolderPath()
}

function onSoundFolderPathBlur(): void {
  void applySoundFolderPath()
}

async function applySoundConfigPath(): Promise<void> {
  if (soundConfigPath.value === lastAppliedSoundConfigPath) return
  const applied = await window.api.setAudioSettingsPath(soundConfigPath.value)
  soundConfigPath.value = applied
  lastAppliedSoundConfigPath = applied
}

async function pickSoundConfigPath(): Promise<void> {
  const picked = await window.api.pickSoundConfigFile()
  if (!picked) return
  soundConfigPath.value = picked
  await applySoundConfigPath()
}

function onSoundConfigPathBlur(): void {
  void applySoundConfigPath()
}

async function applyThemeFolderPath(): Promise<void> {
  if (themeFolderPath.value === lastAppliedThemeFolderPath) return
  const applied = await window.api.setThemeFolderPath(themeFolderPath.value)
  themeFolderPath.value = applied
  lastAppliedThemeFolderPath = applied
}

async function pickThemeFolderPath(): Promise<void> {
  const picked = await window.api.pickThemeFolder()
  if (!picked) return
  themeFolderPath.value = picked
  await applyThemeFolderPath()
}

function onThemeFolderPathBlur(): void {
  void applyThemeFolderPath()
}

function closeModal(): void {
  if (closing.value) return
  closing.value = true
  window.setTimeout(() => {
    window.api.closeModal()
  }, 120)
}

onMounted(() => {
  void loadAppearance().then(() => {
    appearanceReady.value = true
  })
  void loadAppearanceConfigPath()
  stopAppearanceListener = window.api.onAppearanceConfigChanged((config, generation) => {
    if (!appearanceReady.value || syncingAppearance) return
    if (typeof generation === 'number') {
      appearanceGeneration = generation
    }
    // Preview also broadcasts; don't treat it as saved while editing.
    if (appearanceDirty.value) return
    updateSavedBaseline(config)
    applyAppearanceToForm(config)
  })
  stopSystemListener = window.api.onSystemConfigChanged((config) => {
    if (applyingAutoStart) return
    settings.autoStart = config.autoStart
  })
})

onUnmounted(() => {
  stopAppearanceListener?.()
  stopSystemListener?.()
})
</script>

<template>
  <div class="settings-window" :class="{ closing }">
    <div class="window-glow" aria-hidden="true"></div>
    <div class="window-frame">
      <header class="titlebar">
        <div class="titlebar-left">
          <span class="seal-icon" aria-hidden="true">◈</span>
          <h1 class="title">胡桃桌宠</h1>
        </div>
        <div class="window-controls">
          <button type="button" class="win-btn minimize" aria-label="minimize" @click="minimizeModal">
            <span class="icon-minimize"></span>
          </button>
          <button
            type="button"
            class="win-btn close"
            :class="{ active: closing }"
            aria-label="close"
            @click="requestClose"
          >
            <span class="icon-close"></span>
          </button>
        </div>
      </header>

      <div class="body">
        <aside class="nav">
          <nav class="nav-list">
            <button
              v-for="item in navItems"
              :key="item.key"
              type="button"
              class="nav-item"
              :class="{ active: activeNav === item.key }"
              @click="requestNav(item.key)"
            >
              <span class="nav-label">{{ item.label }}</span>
              <span v-if="activeNav === item.key" class="nav-dot" aria-hidden="true"></span>
            </button>
          </nav>
          <div class="nav-footer">版本 {{ appVersion }}</div>
        </aside>

        <main class="content">
          <h2 class="content-title">{{ activeLabel }}</h2>

          <section v-if="activeNav === 'system'" class="panels">
            <div class="group">
              <div class="group-label"><span>基础</span></div>
              <div class="setting-row">
                <span class="setting-name">开机自启动</span>
                <label class="switch">
                  <input v-model="settings.autoStart" type="checkbox" @change="onAutoStartChange" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </label>
              </div>
            </div>

            <div class="group">
              <div class="group-label"><span>文件路径</span></div>
              <div class="path-setting">
                <span class="setting-name">系统配置文件路径</span>
                <div class="path-input-row">
                  <input
                    v-model="systemConfigPath"
                    type="text"
                    class="path-input"
                    spellcheck="false"
                    readonly
                  />
                </div>
              </div>
              <div class="path-setting">
                <span class="setting-name">外观配置文件路径</span>
                <div class="path-input-row">
                  <input
                    v-model="appearanceConfigPath"
                    type="text"
                    class="path-input"
                    spellcheck="false"
                    placeholder="选择或输入 appearance.json 路径"
                    @blur="onAppearanceConfigPathBlur"
                  />
                  <button type="button" class="path-browse" @click="pickAppearanceConfigPath">
                    浏览
                  </button>
                </div>
              </div>
              <div class="path-setting">
                <span class="setting-name">声音文件夹路径</span>
                <div class="path-input-row">
                  <input
                    v-model="soundFolderPath"
                    type="text"
                    class="path-input"
                    spellcheck="false"
                    placeholder="选择或输入声音文件夹路径"
                    @blur="onSoundFolderPathBlur"
                  />
                  <button type="button" class="path-browse" @click="pickSoundFolderPath">
                    浏览
                  </button>
                </div>
              </div>
              <div class="path-setting">
                <span class="setting-name">声音配置文件路径</span>
                <div class="path-input-row">
                  <input
                    v-model="soundConfigPath"
                    type="text"
                    class="path-input"
                    spellcheck="false"
                    placeholder="选择或输入 settings.json 路径"
                    @blur="onSoundConfigPathBlur"
                  />
                  <button type="button" class="path-browse" @click="pickSoundConfigPath">
                    浏览
                  </button>
                </div>
              </div>
              <div class="path-setting">
                <span class="setting-name">主题文件夹路径</span>
                <div class="path-input-row">
                  <input
                    v-model="themeFolderPath"
                    type="text"
                    class="path-input"
                    spellcheck="false"
                    placeholder="选择或输入主题文件夹路径"
                    @blur="onThemeFolderPathBlur"
                  />
                  <button type="button" class="path-browse" @click="pickThemeFolderPath">
                    浏览
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeNav === 'appearance'" class="panels">
            <div class="group">
              <div class="group-label"><span>桌宠大小</span></div>
              <div class="setting-row">
                <span class="setting-name">窗口尺寸</span>
                <div
                  class="slider"
                  :style="{
                    '--val': appearance.petSize,
                    '--min': 180,
                    '--max': 480
                  }"
                >
                  <input
                    v-model.number="appearance.petSize"
                    type="range"
                    min="180"
                    max="480"
                    step="10"
                  />
                  <span class="slider-value">{{ appearance.petSize }}</span>
                </div>
              </div>
            </div>

            <div class="group">
              <div class="group-label"><span>设置按钮</span></div>
              <div class="setting-row">
                <span class="setting-name">按钮大小</span>
                <div
                  class="slider"
                  :style="{
                    '--val': appearance.menuBtnSize,
                    '--min': 36,
                    '--max': 54
                  }"
                >
                  <input
                    v-model.number="appearance.menuBtnSize"
                    type="range"
                    min="36"
                    max="54"
                    step="2"
                  />
                  <span class="slider-value">{{ appearance.menuBtnSize }}</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">距顶部</span>
                <div
                  class="slider"
                  :style="{
                    '--val': appearance.menuBtnTop,
                    '--min': 10,
                    '--max': 20
                  }"
                >
                  <input
                    v-model.number="appearance.menuBtnTop"
                    type="range"
                    min="10"
                    max="20"
                    step="1"
                  />
                  <span class="slider-value">{{ appearance.menuBtnTop }}%</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">距右侧</span>
                <div
                  class="slider"
                  :style="{
                    '--val': appearance.menuBtnRight,
                    '--min': 1,
                    '--max': 10
                  }"
                >
                  <input
                    v-model.number="appearance.menuBtnRight"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                  />
                  <span class="slider-value">{{ appearance.menuBtnRight }}%</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">按钮图标颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnIconColor" />
              </div>
              <div class="setting-row">
                <span class="setting-name">按钮外边框颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnBorderColor" />
              </div>
              <div class="setting-row">
                <span class="setting-name">按钮背景颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnBgColor" />
              </div>
            </div>

            <div class="group">
              <div class="group-label"><span>文本</span></div>
              <div class="setting-row">
                <span class="setting-name">显示文本</span>
                <label class="switch">
                  <input v-model="appearance.speechVisible" type="checkbox" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </label>
              </div>
              <div class="setting-row">
                <span class="setting-name">字号</span>
                <div
                  class="slider"
                  :style="{
                    '--val': appearance.speechFontSize,
                    '--min': 18,
                    '--max': 48
                  }"
                >
                  <input
                    v-model.number="appearance.speechFontSize"
                    type="range"
                    min="18"
                    max="48"
                    step="1"
                  />
                  <span class="slider-value">{{ appearance.speechFontSize }}</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">文字颜色</span>
                <HutaoColorPicker v-model="appearance.speechColor" />
              </div>
            </div>

            <div class="group">
              <div class="group-label speech-content-label">
                <span>文本内容</span>
                <button
                  type="button"
                  class="mini-btn"
                  :disabled="speechTextDrafts.length >= SPEECH_TEXTS_MAX_COUNT"
                  @click="addSpeechText"
                >
                  添加
                </button>
              </div>
              <div
                v-for="(text, index) in speechTextDrafts"
                :key="index"
                class="speech-text-row"
              >
                <input
                  type="text"
                  class="speech-text-input"
                  :class="{ error: Boolean(speechTextsError) }"
                  :value="text"
                  spellcheck="false"
                  :placeholder="`文本 ${index + 1}`"
                  @input="onSpeechTextInput(index, $event)"
                />
                <button
                  type="button"
                  class="mini-btn danger"
                  :disabled="speechTextDrafts.length <= 1"
                  @click="removeSpeechText(index)"
                >
                  删除
                </button>
              </div>
              <p v-if="speechTextsError" class="speech-text-tip error">{{ speechTextsError }}</p>
              <p v-else class="speech-text-tip">
                点击桌宠对话框时按顺序切换，保存时每条不能超过 {{ SPEECH_TEXT_MAX_LENGTH }} 个字，最多
                {{ SPEECH_TEXTS_MAX_COUNT }} 条
              </p>
            </div>

            <div class="actions">
              <button
                type="button"
                class="btn secondary"
                @click="requestAppearanceAction('restoreTheme')"
              >
                恢复到主题
              </button>
              <button
                type="button"
                class="btn secondary"
                @click="requestAppearanceAction('applyTheme')"
              >
                应用到主题
              </button>
              <button
                type="button"
                class="btn secondary"
                @click="requestAppearanceAction('reset')"
              >
                重置
              </button>
              <button
                type="button"
                class="btn primary"
                @click="requestAppearanceAction('save')"
              >
                保存
              </button>
            </div>
          </section>

          <section v-else-if="activeNav === 'sound'" class="panels sound-panels">
            <SoundPanel />
          </section>

          <section v-else-if="activeNav === 'theme'" class="panels theme-panels">
            <ThemePanel />
          </section>

          <section v-else-if="activeNav === 'about'" class="panels about-panels">
            <AboutPanel />
          </section>

          <section v-else class="panels placeholder">
            <p>「{{ activeLabel }}」设置项待接入</p>
          </section>
        </main>
      </div>
    </div>

    <UnsavedChangesDialog
      :open="unsavedDialogOpen"
      @save="handleUnsavedSave"
      @discard="handleUnsavedDiscard"
      @cancel="handleUnsavedCancel"
    />

    <ConfirmDialog
      :open="appearanceConfirmOpen"
      :title="appearanceConfirmCopy.title"
      :message="appearanceConfirmCopy.message"
      :confirm-label="appearanceConfirmCopy.confirmLabel"
      @confirm="confirmAppearanceAction"
      @cancel="cancelAppearanceConfirm"
    />
  </div>
</template>

<style scoped>
.settings-window {
  --bg-page: #171016;
  --bg-window: #24151e;
  --bg-nav: #1d1219;
  --bg-hover: #321a25;
  --bg-active: #542333;
  --cinnabar: #a63b4b;
  --gold: #d4a15b;
  --gold-soft: #e3b36b;
  --text-main: #eadcc8;
  --text-muted: #a88d92;
  --text-active: #f1d5ac;
  --divider: #4a2b35;
  --track: #57313b;

  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
  color: var(--text-main);
  font-family:
    'Source Han Serif SC',
    'Noto Serif SC',
    'Songti SC',
    'SimSun',
    Georgia,
    serif;
}

.settings-window.closing .win-btn.close {
  background: #7a2230;
}

.window-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 8px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.window-frame {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 60% 45% at 12% 8%, rgba(166, 59, 75, 0.08), transparent 60%),
    radial-gradient(ellipse 50% 40% at 88% 92%, rgba(212, 161, 91, 0.05), transparent 55%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.02), transparent 40%),
    var(--bg-window);
  border: 1px solid rgba(212, 161, 91, 0.45);
  box-shadow:
    inset 0 0 0 1px rgba(166, 59, 75, 0.18),
    0 12px 40px rgba(0, 0, 0, 0.4);
}

.window-frame::before {
  content: '梅';
  position: absolute;
  top: 72px;
  left: 28px;
  font-size: 42px;
  color: rgba(166, 59, 75, 0.07);
  pointer-events: none;
  z-index: 0;
}

.window-frame::after {
  content: '蝶';
  position: absolute;
  right: 36px;
  bottom: 28px;
  font-size: 54px;
  color: rgba(212, 161, 91, 0.06);
  pointer-events: none;
  z-index: 0;
}

.titlebar {
  position: relative;
  z-index: 2;
  height: 58px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--divider);
  background: linear-gradient(180deg, rgba(29, 18, 25, 0.9), rgba(36, 21, 30, 0.55));
  -webkit-app-region: drag;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.seal-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(212, 161, 91, 0.7);
  border-radius: 3px;
  color: var(--gold);
  font-size: 12px;
  background: rgba(84, 35, 51, 0.45);
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--text-main);
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 32px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.12s ease;
}

.win-btn:hover {
  background: var(--cinnabar);
}

.win-btn.close:hover,
.win-btn.close.active {
  background: #7a2230;
}

.icon-minimize,
.icon-maximize,
.icon-close {
  display: block;
  position: relative;
}

.icon-minimize {
  width: 12px;
  height: 2px;
  border-radius: 2px;
  background: var(--gold);
  box-shadow: 0 2px 0 rgba(166, 59, 75, 0.35);
}

.icon-maximize {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--gold);
  border-radius: 1px;
  box-shadow: 2px -2px 0 -0.5px transparent, 2px -2px 0 0 var(--gold);
}

.icon-close {
  width: 12px;
  height: 12px;
}

.icon-close::before,
.icon-close::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 13px;
  height: 1.5px;
  border-radius: 1px;
  background: var(--gold);
}

.icon-close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.icon-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 190px 1fr;
}

.nav {
  display: flex;
  flex-direction: column;
  background: var(--bg-nav);
  border-right: 1px solid var(--divider);
}

.nav-list {
  flex: 1;
  padding: 12px 0;
  overflow: auto;
  scrollbar-width: none;
}

.nav-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.nav-item {
  position: relative;
  width: 100%;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 0;
  background: rgba(166, 59, 75, 0.55);
  transition: width 0.16s ease;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--gold-soft);
}

.nav-item:hover::before {
  width: 2px;
}

.nav-item.active {
  background: var(--bg-active);
  color: var(--text-active);
  box-shadow: inset 0 -1px 0 rgba(212, 161, 91, 0.35);
}

.nav-item.active::before {
  width: 3px;
  background: var(--cinnabar);
}

.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 6px rgba(212, 161, 91, 0.55);
}

.nav-footer {
  padding: 14px 20px 18px;
  color: rgba(168, 141, 146, 0.75);
  font-size: 12px;
  letter-spacing: 0.08em;
  border-top: 1px solid rgba(74, 43, 53, 0.7);
}

.content {
  min-width: 0;
  padding: 22px 28px 24px;
  overflow: auto;
  scrollbar-width: none;
  background: linear-gradient(180deg, rgba(23, 16, 22, 0.2), transparent 120px);
}

.content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.content-title {
  margin: 0 0 18px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: #f4e8d6;
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.placeholder {
  color: var(--text-muted);
  font-size: 14px;
  letter-spacing: 0.08em;
}

.about-panels {
  gap: 0;
}

.theme-panels {
  gap: 0;
}

.sound-panels {
  gap: 0;
}

.group {
  border-top: 1px solid rgba(212, 161, 91, 0.28);
}

.group-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 4px;
}

.group-label span {
  padding: 2px 8px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 3px;
  color: var(--gold);
  font-size: 12px;
  letter-spacing: 0.14em;
}

.setting-row {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--divider);
}

.setting-name {
  color: var(--text-main);
  font-size: 14px;
  letter-spacing: 0.08em;
}

.path-setting {
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--divider);
}

.path-setting .setting-name {
  display: block;
  margin-bottom: 10px;
  color: var(--text-main);
  font-size: 14px;
  letter-spacing: 0.08em;
}

.path-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.path-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: rgba(26, 16, 22, 0.85);
  color: var(--text-main);
  font-size: 12px;
  letter-spacing: 0.02em;
  outline: none;
}

.path-input::placeholder {
  color: rgba(168, 141, 146, 0.75);
}

.path-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px rgba(166, 59, 75, 0.25);
}

.path-input[readonly] {
  cursor: default;
  color: var(--text-muted);
}

.path-browse {
  flex: 0 0 auto;
  min-width: 64px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.path-browse:hover {
  color: var(--gold-soft);
  border-color: var(--gold);
  background: rgba(50, 26, 37, 0.55);
}

.switch {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-track {
  width: 42px;
  height: 22px;
  border-radius: 999px;
  background: #3a242c;
  border: 1px solid #5a3640;
  display: flex;
  align-items: center;
  padding: 0 2px;
  transition: background 0.18s ease;
}

.switch-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #c9a36d;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 0.18s ease;
}

.switch input:checked + .switch-track {
  background: var(--cinnabar);
  border-color: #b84b59;
}

.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(20px);
  background: var(--gold);
}

.select {
  position: relative;
  min-width: 120px;
}

.select select {
  width: 100%;
  height: 32px;
  padding: 0 28px 0 12px;
  appearance: none;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: #1a1016;
  color: var(--text-main);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.select::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid var(--gold);
  border-bottom: 1.5px solid var(--gold);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.select select:focus {
  border-color: var(--cinnabar);
  box-shadow: 0 0 0 1px rgba(166, 59, 75, 0.35);
}

.slider {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 180px;
}

.slider input[type='range'] {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--cinnabar) 0%,
    var(--cinnabar) calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    var(--track) calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    var(--track) 100%
  );
  outline: none;
}

.slider input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d6a55e;
  border: 1px solid rgba(255, 236, 200, 0.35);
  box-shadow: 0 0 0 3px rgba(166, 59, 75, 0.15);
  cursor: pointer;
}

.slider-value {
  width: 42px;
  text-align: right;
  color: var(--text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.speech-content-label {
  justify-content: space-between;
}

.speech-text-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--divider);
}

.speech-text-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: rgba(26, 16, 22, 0.85);
  color: var(--text-main);
  font-size: 13px;
  letter-spacing: 0.02em;
  outline: none;
}

.speech-text-input::placeholder {
  color: rgba(168, 141, 146, 0.75);
}

.speech-text-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px rgba(166, 59, 75, 0.25);
}

.speech-text-input.error {
  border-color: rgba(166, 59, 75, 0.85);
}

.speech-text-tip {
  margin: 8px 0 0;
  color: rgba(168, 141, 146, 0.75);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.speech-text-tip.error {
  color: rgba(196, 110, 120, 0.95);
}

.mini-btn {
  flex: 0 0 auto;
  min-width: 52px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(212, 161, 91, 0.4);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.mini-btn:hover:not(:disabled) {
  color: var(--gold-soft, #e3b36b);
  border-color: var(--gold);
  background: rgba(50, 26, 37, 0.55);
}

.mini-btn.danger:hover:not(:disabled) {
  color: #e8b4bb;
  border-color: rgba(196, 110, 120, 0.9);
  background: rgba(166, 59, 75, 0.18);
}

.mini-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 8px;
}

.btn {
  min-width: 84px;
  height: 34px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.btn.primary {
  border: 1px solid rgba(212, 161, 91, 0.7);
  background: var(--cinnabar);
  color: #f7eee2;
}

.btn.primary:hover {
  background: #b64555;
}

.btn.secondary {
  border: 1px solid rgba(212, 161, 91, 0.45);
  background: transparent;
  color: var(--text-muted);
}

.btn.secondary:hover {
  color: var(--gold-soft);
  border-color: var(--gold);
  background: rgba(50, 26, 37, 0.55);
}
</style>

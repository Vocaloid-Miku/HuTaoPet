<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CreateSoundDialog from './CreateSoundDialog.vue'
import type { AudioEntry } from '@shared/audio'

const soundEnabled = ref(true)
const soundVolume = ref(5)
const savedSoundEnabled = ref(true)
const savedSoundVolume = ref(5)
const soundOptions = ref<AudioEntry[]>([])
const activeSound = ref('')
const soundDialogOpen = ref(false)
const soundDialogMode = ref<'create' | 'edit'>('create')
const savingSettings = ref(false)
const syncingActiveSound = ref(false)
const selectOpen = ref(false)
const selectRoot = ref<HTMLElement | null>(null)

const existingNames = computed(() => soundOptions.value.map((item) => item.name))
const activeOption = computed(
  () => soundOptions.value.find((item) => item.name === activeSound.value) ?? null
)
const dialogInitialName = computed(() =>
  soundDialogMode.value === 'edit' ? (activeOption.value?.name ?? '') : ''
)
const dialogInitialPath = computed(() =>
  soundDialogMode.value === 'edit' ? (activeOption.value?.path ?? '') : ''
)
const settingsDirty = computed(
  () =>
    soundEnabled.value !== savedSoundEnabled.value ||
    soundVolume.value !== savedSoundVolume.value
)

function applySystemSoundSettings(config: {
  soundEnabled: boolean
  soundVolume: number
  clickSoundName: string
}): void {
  soundEnabled.value = config.soundEnabled
  soundVolume.value = config.soundVolume
  savedSoundEnabled.value = config.soundEnabled
  savedSoundVolume.value = config.soundVolume
  syncingActiveSound.value = true
  if (
    config.clickSoundName &&
    soundOptions.value.some((item) => item.name === config.clickSoundName)
  ) {
    activeSound.value = config.clickSoundName
  } else if (soundOptions.value.length > 0) {
    activeSound.value = soundOptions.value[0].name
  } else {
    activeSound.value = ''
  }
  syncingActiveSound.value = false
}

function applyAudioEntries(entries: AudioEntry[], preferredName?: string): void {
  soundOptions.value = entries
  const preferred =
    (preferredName && entries.find((item) => item.name === preferredName)?.name) ||
    (activeSound.value && entries.find((item) => item.name === activeSound.value)?.name) ||
    entries[0]?.name ||
    ''
  syncingActiveSound.value = true
  activeSound.value = preferred
  syncingActiveSound.value = false
}

async function loadSoundSettings(): Promise<void> {
  const [audioSettings, entries] = await Promise.all([
    window.api.getAudioSettings(),
    window.api.getAudioEntries()
  ])
  applyAudioEntries(entries, audioSettings.clickSoundName)
  applySystemSoundSettings(audioSettings)
}

async function saveSoundSettings(): Promise<void> {
  if (savingSettings.value || !settingsDirty.value) return
  savingSettings.value = true
  try {
    const saved = await window.api.setSoundSettings({
      soundEnabled: soundEnabled.value,
      soundVolume: soundVolume.value
    })
    applySystemSoundSettings(saved)
  } finally {
    savingSettings.value = false
  }
}

async function onActiveSoundChange(name: string): Promise<void> {
  if (!name || syncingActiveSound.value) return
  selectOpen.value = false
  const saved = await window.api.setClickSoundName(name)
  syncingActiveSound.value = true
  activeSound.value = saved.clickSoundName
  syncingActiveSound.value = false
}

function toggleSelect(): void {
  if (soundOptions.value.length === 0) return
  selectOpen.value = !selectOpen.value
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!selectOpen.value || !selectRoot.value) return
  if (!selectRoot.value.contains(event.target as Node)) {
    selectOpen.value = false
  }
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && selectOpen.value) {
    selectOpen.value = false
  }
}

function openCreateDialog(): void {
  selectOpen.value = false
  soundDialogMode.value = 'create'
  soundDialogOpen.value = true
}

function openEditDialog(): void {
  if (!activeOption.value) return
  selectOpen.value = false
  soundDialogMode.value = 'edit'
  soundDialogOpen.value = true
}

function closeSoundDialog(): void {
  soundDialogOpen.value = false
}

async function handleSoundSave(payload: { name: string; path: string }): Promise<void> {
  try {
    if (soundDialogMode.value === 'edit' && activeOption.value) {
      const entries = await window.api.updateAudioEntry({
        oldName: activeOption.value.name,
        name: payload.name,
        path: payload.path
      })
      applyAudioEntries(entries, payload.name)
      await window.api.setClickSoundName(payload.name)
    } else {
      const entries = await window.api.addAudioEntry({
        name: payload.name,
        path: payload.path
      })
      applyAudioEntries(entries, payload.name)
      await window.api.setClickSoundName(payload.name)
    }
    soundDialogOpen.value = false
  } catch (error) {
    console.warn('Failed to save audio entry:', error)
  }
}

async function deleteCurrentSound(): Promise<void> {
  if (!activeOption.value) return

  const deletingName = activeOption.value.name
  try {
    const entries = await window.api.deleteAudioEntry(deletingName)
    const nextName = entries[0]?.name ?? ''
    applyAudioEntries(entries, nextName)
    if (nextName) {
      await window.api.setClickSoundName(nextName)
    } else {
      await window.api.setClickSoundName('')
    }
  } catch (error) {
    console.warn('Failed to delete audio entry:', error)
  }
}

let stopAudioSettingsListener: (() => void) | undefined

onMounted(() => {
  void loadSoundSettings()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
  stopAudioSettingsListener = window.api.onAudioSettingsChanged((config) => {
    if (settingsDirty.value) {
      syncingActiveSound.value = true
      if (soundOptions.value.some((item) => item.name === config.clickSoundName)) {
        activeSound.value = config.clickSoundName
      }
      syncingActiveSound.value = false
      return
    }
    applySystemSoundSettings(config)
  })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
  stopAudioSettingsListener?.()
})
</script>

<template>
  <section class="sound-panel">
    <div class="group">
      <div class="group-label"><span>设置</span></div>
      <div class="setting-row">
        <span class="setting-name">启用声音</span>
        <label class="switch">
          <input v-model="soundEnabled" type="checkbox" />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
      </div>
      <div class="setting-row">
        <span class="setting-name">声音大小</span>
        <div
          class="slider"
          :style="{
            '--val': soundVolume,
            '--min': 0,
            '--max': 10
          }"
        >
          <input v-model.number="soundVolume" type="range" min="0" max="10" step="1" />
          <span class="slider-value">{{ soundVolume }}</span>
        </div>
      </div>
      <div class="setting-actions">
        <button
          type="button"
          class="sound-save"
          :disabled="!settingsDirty || savingSettings"
          @click="saveSoundSettings"
        >
          保存
        </button>
      </div>
    </div>

    <div class="group">
      <div class="group-label"><span>新建</span></div>
      <div class="setting-row">
        <span class="setting-name">新建声音</span>
        <button type="button" class="sound-action" @click="openCreateDialog">导入</button>
      </div>
    </div>

    <div class="group">
      <div class="group-label"><span>声音</span></div>
      <div class="setting-row">
        <span class="setting-name">点击音效</span>
        <div ref="selectRoot" class="select" :class="{ open: selectOpen }">
          <button
            type="button"
            class="select-trigger"
            :disabled="soundOptions.length === 0"
            :aria-expanded="selectOpen"
            aria-haspopup="listbox"
            @click="toggleSelect"
          >
            <span class="select-label">{{ activeSound || '暂无音效' }}</span>
            <span class="select-caret" aria-hidden="true"></span>
          </button>
          <ul v-show="selectOpen" class="select-menu" role="listbox">
            <li
              v-for="item in soundOptions"
              :key="item.name"
              class="select-option"
              :class="{ active: item.name === activeSound }"
              role="option"
              :aria-selected="item.name === activeSound"
              @click="onActiveSoundChange(item.name)"
            >
              {{ item.name }}
            </li>
          </ul>
        </div>
      </div>
      <div class="setting-row">
        <span class="setting-name">编辑当前音效</span>
        <button type="button" class="sound-action" @click="openEditDialog">编辑</button>
      </div>
      <div class="setting-row">
        <span class="setting-name">删除当前音效</span>
        <button
          type="button"
          class="sound-action"
          :disabled="!activeOption"
          @click="deleteCurrentSound"
        >
          删除
        </button>
      </div>
    </div>

    <CreateSoundDialog
      :open="soundDialogOpen"
      :mode="soundDialogMode"
      :initial-name="dialogInitialName"
      :initial-path="dialogInitialPath"
      :existing-names="existingNames"
      @cancel="closeSoundDialog"
      @save="handleSoundSave"
    />
  </section>
</template>

<style scoped>
.sound-panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
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
  color: var(--gold, #d4a15b);
  font-size: 12px;
  letter-spacing: 0.14em;
}

.setting-row {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--divider, #4a2b35);
}

.setting-name {
  color: var(--text-main, #eadcc8);
  font-size: 14px;
  letter-spacing: 0.08em;
}

.setting-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 4px;
}

.sound-save {
  min-width: 76px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(212, 161, 91, 0.7);
  border-radius: 4px;
  background: var(--cinnabar, #a63b4b);
  color: #f7eee2;
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    opacity 0.16s ease;
}

.sound-save:hover:not(:disabled) {
  background: #b64555;
  border-color: var(--gold, #d4a15b);
}

.sound-save:disabled {
  opacity: 0.45;
  cursor: default;
}

.sound-action {
  min-width: 64px;
  height: 30px;
  padding: 0 14px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted, #a88d92);
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.sound-action:hover:not(:disabled) {
  color: var(--gold-soft, #e3b36b);
  border-color: var(--gold, #d4a15b);
  background: rgba(50, 26, 37, 0.55);
}

.sound-action:disabled {
  opacity: 0.45;
  cursor: default;
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
  background: var(--cinnabar, #a63b4b);
  border-color: #b84b59;
}

.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(20px);
  background: var(--gold, #d4a15b);
}

.select {
  position: relative;
  z-index: 2;
  min-width: 148px;
}

.select.open {
  z-index: 20;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: #1a1016;
  color: var(--text-main, #eadcc8);
  font-size: 13px;
  letter-spacing: 0.06em;
  outline: none;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.select-trigger:hover:not(:disabled) {
  border-color: var(--gold, #d4a15b);
  background: rgba(50, 26, 37, 0.55);
}

.select-trigger:focus-visible,
.select.open .select-trigger {
  border-color: var(--cinnabar, #a63b4b);
  box-shadow: 0 0 0 1px rgba(166, 59, 75, 0.35);
}

.select-trigger:disabled {
  opacity: 0.45;
  cursor: default;
}

.select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-caret {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid var(--gold, #d4a15b);
  border-bottom: 1.5px solid var(--gold, #d4a15b);
  transform: translateY(-1px) rotate(45deg);
  transition: transform 0.16s ease;
}

.select.open .select-caret {
  transform: translateY(1px) rotate(225deg);
}

.select-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 196px;
  overflow-y: auto;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: #2c1822;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.select-option {
  height: 30px;
  padding: 0 10px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  color: var(--text-main, #eadcc8);
  font-size: 13px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.select-option:hover {
  background: rgba(84, 35, 51, 0.72);
  color: var(--gold-soft, #e3b36b);
}

.select-option.active {
  background: #542333;
  color: #f1d5ac;
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
    var(--cinnabar, #a63b4b) 0%,
    var(--cinnabar, #a63b4b)
      calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    var(--track, #57313b)
      calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    var(--track, #57313b) 100%
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
  color: var(--text-muted, #a88d92);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ThemeDetail, ThemeOption } from '@shared/theme'
import CreateThemeDialog from './CreateThemeDialog.vue'

const themeOptions = ref<ThemeOption[]>([])
const activeTheme = ref('')
const switching = ref(false)
const pendingTheme = ref('')
const themeDialogOpen = ref(false)
const themeDialogMode = ref<'create' | 'edit'>('create')
const editTheme = ref<ThemeDetail | null>(null)

async function loadThemes(): Promise<void> {
  const [options, activeId] = await Promise.all([
    window.api.getThemeOptions(),
    window.api.getActiveThemeId()
  ])
  themeOptions.value = options
  activeTheme.value = activeId || options[0]?.id || ''
}

async function onThemeClick(themeId: string): Promise<void> {
  if (!themeId || switching.value || themeDialogOpen.value) return
  if (themeId === activeTheme.value) {
    switching.value = true
    try {
      editTheme.value = await window.api.getThemeDetail(themeId)
      themeDialogMode.value = 'edit'
      themeDialogOpen.value = true
    } catch (error) {
      console.warn('Failed to load theme detail:', error)
    } finally {
      switching.value = false
    }
    return
  }
  switching.value = true
  pendingTheme.value = themeId
  try {
    const result = await window.api.setActiveTheme(themeId)
    activeTheme.value = result.config.activeTheme
  } catch (error) {
    console.warn('Failed to switch theme:', error)
    await loadThemes()
  } finally {
    switching.value = false
    pendingTheme.value = ''
  }
}

function openImportDialog(): void {
  if (switching.value) return
  themeDialogMode.value = 'create'
  editTheme.value = null
  themeDialogOpen.value = true
}

function closeThemeDialog(): void {
  themeDialogOpen.value = false
  editTheme.value = null
  themeDialogMode.value = 'create'
}

async function handleThemeDialogSaved(): Promise<void> {
  themeDialogOpen.value = false
  editTheme.value = null
  themeDialogMode.value = 'create'
  await loadThemes()
}

async function handleThemeDialogDeleted(): Promise<void> {
  themeDialogOpen.value = false
  editTheme.value = null
  themeDialogMode.value = 'create'
  await loadThemes()
}

onMounted(() => {
  void loadThemes()
})
</script>

<template>
  <section class="theme-panel">
    <div class="group">
      <div class="group-label"><span>新建</span></div>
      <div class="setting-row">
        <span class="setting-name">新建主题</span>
        <button type="button" class="theme-action" :disabled="switching" @click="openImportDialog">
          导入
        </button>
      </div>
    </div>

    <div class="group">
      <div class="group-label"><span>主题</span></div>
      <div class="theme-grid" role="list" aria-label="主题列表">
        <button
          v-for="theme in themeOptions"
          :key="theme.id"
          type="button"
          class="theme-card"
          :class="{
            active: theme.id === activeTheme,
            pending: switching && theme.id === pendingTheme
          }"
          :disabled="switching"
          :aria-pressed="theme.id === activeTheme"
          @click="onThemeClick(theme.id)"
        >
          <span class="theme-card-name">{{ theme.label }}</span>
          <span
            v-if="theme.id === activeTheme"
            class="theme-active-dot"
            aria-hidden="true"
          ></span>
          <span
            v-if="switching && theme.id === pendingTheme"
            class="theme-loading"
            aria-hidden="true"
          ></span>
        </button>
      </div>
    </div>

    <CreateThemeDialog
      :open="themeDialogOpen"
      :mode="themeDialogMode"
      :edit-theme="editTheme"
      :existing-themes="themeOptions"
      @cancel="closeThemeDialog"
      @saved="handleThemeDialogSaved"
      @deleted="handleThemeDialogDeleted"
    />
  </section>
</template>

<style scoped>
.theme-panel {
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

.theme-action {
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

.theme-action:hover:not(:disabled) {
  color: var(--gold-soft, #e3b36b);
  border-color: var(--gold, #d4a15b);
  background: rgba(50, 26, 37, 0.55);
}

.theme-action:disabled {
  opacity: 0.45;
  cursor: default;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 0 4px;
}

.theme-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(212, 161, 91, 0.28);
  border-radius: 5px;
  background: #1a1016;
  color: var(--text-muted, #a88d92);
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease;
}

.theme-card:hover:not(:disabled) {
  background: #321a25;
  border-color: var(--gold, #d4a15b);
  color: var(--gold-soft, #e3b36b);
}

.theme-card.active {
  border: 2px solid var(--gold, #d4a15b);
  background: #542333;
  color: #f1d5ac;
}

.theme-card.pending {
  opacity: 0.7;
}

.theme-card:disabled {
  cursor: default;
}

.theme-card:focus-visible {
  outline: 2px solid var(--cinnabar, #a63b4b);
  outline-offset: 2px;
}

.theme-card-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-align: center;
}

.theme-active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold, #d4a15b);
}

.theme-loading {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(212, 161, 91, 0.25);
  border-top-color: var(--gold, #d4a15b);
  border-radius: 50%;
  animation: theme-spin 0.7s linear infinite;
}

@keyframes theme-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

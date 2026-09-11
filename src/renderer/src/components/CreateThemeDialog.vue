<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import HutaoColorPicker from './HutaoColorPicker.vue'
import {
  DEFAULT_APPEARANCE,
  SPEECH_TEXT_MAX_LENGTH,
  SPEECH_TEXTS_MAX_COUNT,
  cloneAppearanceConfig,
  normalizeAppearanceConfig,
  sanitizeSpeechTextsForSave,
  validateSpeechTextsForSave,
  type AppearanceConfig
} from '@shared/appearance'
import { THEME_ID_PATTERN, type ThemeDetail, type ThemeOption } from '@shared/theme'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode?: 'create' | 'edit'
    editTheme?: ThemeDetail | null
    existingThemes?: ThemeOption[]
  }>(),
  {
    mode: 'create',
    editTheme: null,
    existingThemes: () => []
  }
)

const emit = defineEmits<{
  cancel: []
  saved: []
  deleted: []
}>()

const isEdit = computed(() => props.mode === 'edit')
const dialogTitle = computed(() => (isEdit.value ? '编辑主题' : '新建主题'))
const submitLabel = computed(() => {
  if (importing.value) return isEdit.value ? '正在保存' : '正在导入'
  return isEdit.value ? '保存' : '导入主题'
})
const canDelete = computed(() => isEdit.value && props.existingThemes.length > 1)
const deleteLabel = computed(() => {
  if (deleting.value) return '正在删除'
  return confirmDelete.value ? '确认删除' : '删除主题'
})

const label = ref('')
const themeId = ref('')
const idTouched = ref(false)
const basePath = ref('')
const characterPath = ref('')
const appearance = reactive<AppearanceConfig>(cloneAppearanceConfig(DEFAULT_APPEARANCE))
const triedSubmit = ref(false)
const importing = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const formError = ref('')

const labelError = ref('')
const idError = ref('')
const baseError = ref('')
const characterError = ref('')

const canShowErrors = computed(() => triedSubmit.value)
const otherThemes = computed(() =>
  isEdit.value
    ? props.existingThemes.filter((item) => item.id !== themeId.value)
    : props.existingThemes
)

function suggestIdFromLabel(value: string): string {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (!ascii || !THEME_ID_PATTERN.test(ascii)) return ''
  return ascii
}

async function loadAppearanceFromThemeDefault(): Promise<void> {
  const defaults = await window.api.getThemeDefaultAppearance()
  Object.assign(appearance, cloneAppearanceConfig(normalizeAppearanceConfig(defaults)))
}

function resetFormState(): void {
  label.value = ''
  themeId.value = ''
  idTouched.value = false
  basePath.value = ''
  characterPath.value = ''
  triedSubmit.value = false
  importing.value = false
  deleting.value = false
  confirmDelete.value = false
  formError.value = ''
  labelError.value = ''
  idError.value = ''
  baseError.value = ''
  characterError.value = ''
}

function applyEditTheme(detail: ThemeDetail): void {
  label.value = detail.label
  themeId.value = detail.id
  idTouched.value = true
  basePath.value = detail.basePath
  characterPath.value = detail.characterPath
  Object.assign(appearance, cloneAppearanceConfig(normalizeAppearanceConfig(detail.appearance)))
}

function addSpeechText(): void {
  if (appearance.speechTexts.length >= SPEECH_TEXTS_MAX_COUNT) return
  appearance.speechTexts.push('')
}

function removeSpeechText(index: number): void {
  if (appearance.speechTexts.length <= 1) return
  appearance.speechTexts.splice(index, 1)
}

function onSpeechTextInput(index: number, event: Event): void {
  const target = event.target as HTMLInputElement
  appearance.speechTexts[index] = target.value
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    resetFormState()
    if (isEdit.value) {
      if (!props.editTheme) {
        formError.value = '主题不存在'
        return
      }
      applyEditTheme(props.editTheme)
      return
    }
    await loadAppearanceFromThemeDefault()
  }
)

watch(label, (value) => {
  if (isEdit.value || idTouched.value) return
  themeId.value = suggestIdFromLabel(value)
})

function validateClient(): boolean {
  const trimmedLabel = label.value.trim()
  const trimmedId = themeId.value.trim()
  const trimmedBase = basePath.value.trim()
  const trimmedCharacter = characterPath.value.trim()
  let ok = true

  labelError.value = ''
  idError.value = ''
  baseError.value = ''
  characterError.value = ''
  formError.value = ''

  if (!trimmedLabel) {
    labelError.value = '请输入主题名称'
    ok = false
  } else if (trimmedLabel.length > 20) {
    labelError.value = '主题名称不能超过 20 个字符'
    ok = false
  } else if (
    otherThemes.value.some((item) => item.label.trim().toLowerCase() === trimmedLabel.toLowerCase())
  ) {
    labelError.value = '主题名称已存在'
    ok = false
  }

  if (!trimmedId) {
    idError.value = '请输入目录 ID'
    ok = false
  } else if (!THEME_ID_PATTERN.test(trimmedId)) {
    idError.value = '目录 ID 只能包含小写字母、数字和连字符'
    ok = false
  } else if (!isEdit.value && otherThemes.value.some((item) => item.id === trimmedId)) {
    idError.value = '主题 ID 已存在'
    ok = false
  }

  if (!trimmedBase) {
    baseError.value = '请选择原图'
    ok = false
  }

  if (!trimmedCharacter) {
    characterError.value = '请选择单个角色图'
    ok = false
  } else if (trimmedBase && trimmedCharacter.toLowerCase() === trimmedBase.toLowerCase()) {
    characterError.value = '原图和单个角色图不能是同一个文件'
    ok = false
  }

  return ok
}

async function pickBaseImage(): Promise<void> {
  if (isEdit.value || importing.value || deleting.value) return
  const picked = await window.api.pickThemeImage()
  if (!picked) return
  basePath.value = picked
  if (triedSubmit.value) baseError.value = ''
}

async function pickCharacterImage(): Promise<void> {
  if (isEdit.value || importing.value || deleting.value) return
  const picked = await window.api.pickThemeImage()
  if (!picked) return
  characterPath.value = picked
  if (triedSubmit.value) characterError.value = ''
}

function handleCancel(): void {
  if (importing.value || deleting.value) return
  emit('cancel')
}

async function handleDelete(): Promise<void> {
  if (!isEdit.value || importing.value || deleting.value) return
  if (!canDelete.value) {
    formError.value = '至少保留一个主题'
    return
  }
  if (!confirmDelete.value) {
    confirmDelete.value = true
    formError.value = ''
    return
  }

  const id = themeId.value.trim()
  if (!id) {
    formError.value = '主题不存在'
    return
  }

  deleting.value = true
  formError.value = ''
  try {
    await window.api.deleteTheme(id)
    emit('deleted')
  } catch (error) {
    const raw = error instanceof Error ? error.message : '主题删除失败'
    const match = raw.match(/Error invoking remote method[^:]+: Error: (.+)$/)
    formError.value = match?.[1] ?? raw
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

async function handleImport(): Promise<void> {
  if (importing.value || deleting.value) return
  confirmDelete.value = false
  triedSubmit.value = true
  if (!validateClient()) return

  const speechError = validateSpeechTextsForSave(appearance.speechTexts)
  if (speechError) {
    formError.value = speechError
    return
  }

  importing.value = true
  formError.value = ''
  const payload = {
    id: themeId.value.trim(),
    label: label.value.trim(),
    basePath: basePath.value.trim(),
    characterPath: characterPath.value.trim(),
    appearance: normalizeAppearanceConfig({
      ...appearance,
      speechTexts: sanitizeSpeechTextsForSave(appearance.speechTexts)
    })
  }
  try {
    if (isEdit.value) {
      await window.api.updateTheme(payload)
    } else {
      await window.api.createTheme(payload)
    }
    emit('saved')
  } catch (error) {
    const fallback = isEdit.value ? '主题保存失败' : '主题导入失败'
    const raw = error instanceof Error ? error.message : fallback
    const match = raw.match(/Error invoking remote method[^:]+: Error: (.+)$/)
    formError.value = match?.[1] ?? raw
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="create-theme-dialog">
      <div v-if="open" class="create-overlay" @click.self="handleCancel">
        <div
          class="create-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-theme-title"
        >
          <header class="create-header">
            <h3 id="create-theme-title" class="create-title">{{ dialogTitle }}</h3>
          </header>

          <div class="create-body">
            <div class="group">
              <div class="group-label"><span>基本信息</span></div>
              <div class="field">
                <label class="field-label" for="create-theme-label">主题名称</label>
                <input
                  id="create-theme-label"
                  v-model="label"
                  type="text"
                  class="field-input"
                  :class="{ error: canShowErrors && labelError }"
                  :disabled="importing"
                  spellcheck="false"
                  maxlength="20"
                  placeholder="输入主题名称"
                />
                <p v-if="canShowErrors && labelError" class="field-tip error">{{ labelError }}</p>
              </div>
              <div class="field">
                <label class="field-label" for="create-theme-id">目录 ID</label>
                <input
                  id="create-theme-id"
                  v-model="themeId"
                  type="text"
                  class="field-input"
                  :class="{ error: canShowErrors && idError }"
                  :disabled="importing || isEdit"
                  spellcheck="false"
                  placeholder="例如 furina"
                  @input="idTouched = true"
                />
                <p v-if="canShowErrors && idError" class="field-tip error">{{ idError }}</p>
                <p v-else-if="isEdit" class="field-tip">目录 ID 创建后不可修改</p>
                <p v-else class="field-tip">仅小写字母、数字和连字符，将作为主题文件夹名</p>
              </div>
            </div>

            <div class="group">
              <div class="group-label"><span>角色资源</span></div>
              <div class="field">
                <label class="field-label" for="create-theme-base">原图</label>
                <div class="path-row">
                  <input
                    id="create-theme-base"
                    v-model="basePath"
                    type="text"
                    class="field-input path-input"
                    :class="{ error: canShowErrors && baseError }"
                    :disabled="importing || isEdit"
                    spellcheck="false"
                    :readonly="isEdit"
                    placeholder="选择或输入原图路径"
                  />
                  <button
                    type="button"
                    class="browse-btn"
                    :disabled="importing || isEdit"
                    @click="pickBaseImage"
                  >
                    浏览
                  </button>
                </div>
                <p v-if="canShowErrors && baseError" class="field-tip error">{{ baseError }}</p>
                <p v-else-if="isEdit" class="field-tip">角色资源创建后不可修改</p>
                <p v-else class="field-tip">用于桌宠显示，导入后保存为 base.png</p>
              </div>
              <div class="field">
                <label class="field-label" for="create-theme-character">单个角色图</label>
                <div class="path-row">
                  <input
                    id="create-theme-character"
                    v-model="characterPath"
                    type="text"
                    class="field-input path-input"
                    :class="{ error: canShowErrors && characterError }"
                    :disabled="importing || isEdit"
                    spellcheck="false"
                    :readonly="isEdit"
                    placeholder="选择或输入角色图路径"
                  />
                  <button
                    type="button"
                    class="browse-btn"
                    :disabled="importing || isEdit"
                    @click="pickCharacterImage"
                  >
                    浏览
                  </button>
                </div>
                <p v-if="canShowErrors && characterError" class="field-tip error">
                  {{ characterError }}
                </p>
                <p v-else-if="!isEdit" class="field-tip">只保留角色本体和透明背景，用于生成点击区域</p>
              </div>
            </div>

            <div class="group">
              <div class="group-label"><span>外观配置</span></div>

              <div class="setting-row">
                <span class="setting-name">桌宠大小</span>
                <div
                  class="slider"
                  :style="{ '--val': appearance.petSize, '--min': 180, '--max': 480 }"
                >
                  <input
                    v-model.number="appearance.petSize"
                    type="range"
                    min="180"
                    max="480"
                    step="10"
                    :disabled="importing"
                  />
                  <span class="slider-value">{{ appearance.petSize }}</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单按钮大小</span>
                <div
                  class="slider"
                  :style="{ '--val': appearance.menuBtnSize, '--min': 36, '--max': 54 }"
                >
                  <input
                    v-model.number="appearance.menuBtnSize"
                    type="range"
                    min="36"
                    max="54"
                    step="2"
                    :disabled="importing"
                  />
                  <span class="slider-value">{{ appearance.menuBtnSize }}</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单距顶部</span>
                <div
                  class="slider"
                  :style="{ '--val': appearance.menuBtnTop, '--min': 10, '--max': 20 }"
                >
                  <input
                    v-model.number="appearance.menuBtnTop"
                    type="range"
                    min="10"
                    max="20"
                    step="1"
                    :disabled="importing"
                  />
                  <span class="slider-value">{{ appearance.menuBtnTop }}%</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单距右侧</span>
                <div
                  class="slider"
                  :style="{ '--val': appearance.menuBtnRight, '--min': 1, '--max': 10 }"
                >
                  <input
                    v-model.number="appearance.menuBtnRight"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    :disabled="importing"
                  />
                  <span class="slider-value">{{ appearance.menuBtnRight }}%</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单图标颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnIconColor" />
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单边框颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnBorderColor" />
              </div>
              <div class="setting-row">
                <span class="setting-name">菜单背景颜色</span>
                <HutaoColorPicker v-model="appearance.menuBtnBgColor" />
              </div>
              <div class="setting-row">
                <span class="setting-name">显示文本</span>
                <label class="switch">
                  <input
                    v-model="appearance.speechVisible"
                    type="checkbox"
                    :disabled="importing"
                  />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </label>
              </div>
              <div class="setting-row">
                <span class="setting-name">文本字号</span>
                <div
                  class="slider"
                  :style="{ '--val': appearance.speechFontSize, '--min': 18, '--max': 48 }"
                >
                  <input
                    v-model.number="appearance.speechFontSize"
                    type="range"
                    min="18"
                    max="48"
                    step="1"
                    :disabled="importing"
                  />
                  <span class="slider-value">{{ appearance.speechFontSize }}</span>
                </div>
              </div>
              <div class="setting-row">
                <span class="setting-name">文本颜色</span>
                <HutaoColorPicker v-model="appearance.speechColor" />
              </div>

                  <div class="speech-content-block">
                <div class="speech-content-head">
                  <span class="setting-name">文本内容</span>
                  <button
                    type="button"
                    class="mini-btn"
                    :disabled="importing || appearance.speechTexts.length >= SPEECH_TEXTS_MAX_COUNT"
                    @click="addSpeechText"
                  >
                    添加
                  </button>
                </div>
                <div
                  v-for="(text, index) in appearance.speechTexts"
                  :key="index"
                  class="speech-text-row"
                >
                  <input
                    type="text"
                    class="field-input speech-text-input"
                    :value="text"
                    :disabled="importing"
                    spellcheck="false"
                    :placeholder="`文本 ${index + 1}`"
                    @input="onSpeechTextInput(index, $event)"
                  />
                  <button
                    type="button"
                    class="mini-btn"
                    :disabled="importing || appearance.speechTexts.length <= 1"
                    @click="removeSpeechText(index)"
                  >
                    删除
                  </button>
                </div>
                <p class="field-tip">保存时每条不能超过 {{ SPEECH_TEXT_MAX_LENGTH }} 个中文字符</p>
              </div>
            </div>
          </div>

          <footer class="create-actions">
            <p v-if="formError" class="form-error">{{ formError }}</p>
            <div class="action-row" :class="{ 'has-delete': isEdit }">
              <button
                v-if="isEdit"
                type="button"
                class="action-btn danger"
                :class="{ confirm: confirmDelete }"
                :disabled="importing || deleting || !canDelete"
                :title="canDelete ? '' : '至少保留一个主题'"
                @click="handleDelete"
              >
                {{ deleteLabel }}
              </button>
              <div class="action-right">
                <button
                  type="button"
                  class="action-btn cancel"
                  :disabled="importing || deleting"
                  @click="handleCancel"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="action-btn save"
                  :disabled="importing || deleting"
                  @click="handleImport"
                >
                  {{ submitLabel }}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.create-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 8, 10, 0.58);
}

.create-dialog {
  width: 680px;
  max-height: 510px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(212, 161, 91, 0.55);
  border-radius: 10px;
  background: linear-gradient(165deg, #24151e 0%, #2b1822 100%);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(166, 59, 75, 0.18),
    0 0 28px rgba(166, 59, 75, 0.1);
  overflow: hidden;
}

.create-header {
  flex: 0 0 48px;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(212, 161, 91, 0.28);
}

.create-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #e3b36b;
}

.create-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: none;
}

.create-body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.group {
  border-top: 1px solid rgba(212, 161, 91, 0.22);
  padding-bottom: 8px;
}

.group:first-child {
  border-top: none;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 8px;
}

.group-label > span:first-child {
  padding: 2px 8px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 3px;
  color: var(--gold, #d4a15b);
  font-size: 12px;
  letter-spacing: 0.14em;
}

.speech-content-block {
  padding: 8px 0 4px;
  border-bottom: 1px solid rgba(74, 43, 53, 0.7);
}

.speech-content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.speech-text-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.speech-text-input {
  flex: 1;
  min-width: 0;
}

.mini-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(212, 161, 91, 0.4);
  border-radius: 4px;
  background: transparent;
  color: #a88d92;
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.mini-btn:hover:not(:disabled) {
  color: #e3b36b;
  border-color: #d4a15b;
  background: rgba(50, 26, 37, 0.55);
}

.mini-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.field-label {
  color: #eadcc8;
  font-size: 13px;
  letter-spacing: 0.1em;
}

.field-input {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(212, 161, 91, 0.45);
  border-radius: 4px;
  background: rgba(26, 16, 22, 0.9);
  color: #eadcc8;
  font-size: 13px;
  letter-spacing: 0.02em;
  outline: none;
  box-sizing: border-box;
}

.field-input::placeholder {
  color: rgba(168, 141, 146, 0.7);
}

.field-input:focus {
  border-color: #a63b4b;
  box-shadow: 0 0 0 1px rgba(166, 59, 75, 0.35);
}

.field-input.error {
  border-color: rgba(166, 59, 75, 0.85);
}

.field-input:disabled {
  opacity: 0.55;
}

.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.path-input {
  flex: 1;
  min-width: 0;
}

.browse-btn {
  flex: 0 0 auto;
  min-width: 60px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(212, 161, 91, 0.42);
  border-radius: 4px;
  background: transparent;
  color: #a88d92;
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.browse-btn:hover:not(:disabled) {
  color: #e3b36b;
  border-color: #d4a15b;
  background: rgba(50, 26, 37, 0.55);
}

.browse-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.field-tip {
  margin: 0;
  min-height: 16px;
  font-size: 11px;
  line-height: 1.4;
  letter-spacing: 0.04em;
  color: rgba(168, 141, 146, 0.75);
}

.field-tip.error {
  color: rgba(196, 110, 120, 0.95);
}

.setting-row {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid rgba(74, 43, 53, 0.7);
}

.setting-name {
  color: #eadcc8;
  font-size: 13px;
  letter-spacing: 0.08em;
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
    #a63b4b 0%,
    #a63b4b calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    #57313b calc((var(--val, 0) - var(--min, 0)) * 100% / (var(--max, 100) - var(--min, 0))),
    #57313b 100%
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
  cursor: pointer;
}

.slider-value {
  width: 42px;
  text-align: right;
  color: #a88d92;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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
}

.switch-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #c9a36d;
  transition: transform 0.18s ease;
}

.switch input:checked + .switch-track {
  background: #a63b4b;
  border-color: #b84b59;
}

.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(20px);
  background: #d4a15b;
}

.create-actions {
  flex: 0 0 auto;
  min-height: 58px;
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(212, 161, 91, 0.28);
}

.form-error {
  margin: 0 0 10px;
  text-align: right;
  color: rgba(196, 110, 120, 0.95);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.action-row.has-delete {
  justify-content: space-between;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.action-btn {
  min-width: 88px;
  height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
}

.action-btn.cancel {
  border: 1px solid rgba(212, 161, 91, 0.45);
  background: transparent;
  color: #a88d92;
}

.action-btn.cancel:hover:not(:disabled) {
  color: #e3b36b;
  border-color: #d4a15b;
  background: rgba(50, 26, 37, 0.55);
}

.action-btn.save {
  border: 1px solid rgba(212, 161, 91, 0.7);
  background: #a63b4b;
  color: #f7eee2;
}

.action-btn.save:hover:not(:disabled) {
  background: #b64555;
  border-color: #e3b36b;
}

.action-btn.danger {
  border: 1px solid rgba(166, 59, 75, 0.55);
  background: transparent;
  color: rgba(196, 110, 120, 0.95);
}

.action-btn.danger:hover:not(:disabled) {
  border-color: rgba(196, 110, 120, 0.9);
  background: rgba(166, 59, 75, 0.18);
  color: #e8b4bb;
}

.action-btn.danger.confirm {
  border-color: rgba(196, 110, 120, 0.95);
  background: rgba(166, 59, 75, 0.85);
  color: #f7eee2;
}

.action-btn.danger.confirm:hover:not(:disabled) {
  background: rgba(176, 69, 85, 0.95);
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.create-theme-dialog-enter-active,
.create-theme-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.create-theme-dialog-enter-active .create-dialog,
.create-theme-dialog-leave-active .create-dialog {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.create-theme-dialog-enter-from,
.create-theme-dialog-leave-to {
  opacity: 0;
}

.create-theme-dialog-enter-from .create-dialog,
.create-theme-dialog-leave-to .create-dialog {
  opacity: 0;
  transform: translateY(8px);
}
</style>

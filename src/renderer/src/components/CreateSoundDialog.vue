<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode?: 'create' | 'edit'
    initialName?: string
    initialPath?: string
    existingNames?: string[]
  }>(),
  {
    mode: 'create',
    initialName: '',
    initialPath: '',
    existingNames: () => []
  }
)

const emit = defineEmits<{
  cancel: []
  save: [payload: { name: string; path: string }]
}>()

const name = ref('')
const filePath = ref('')
const nameError = ref('')
const pathError = ref('')
const triedSubmit = ref(false)

const formatHint = '支持 mp3、wav、ogg、m4a 等常见音频格式'
const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑声音' : '新建声音'))
const canShowErrors = computed(() => triedSubmit.value)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.initialName
    filePath.value = props.initialPath
    nameError.value = ''
    pathError.value = ''
    triedSubmit.value = false
  }
)

function validate(): boolean {
  const trimmedName = name.value.trim()
  const trimmedPath = filePath.value.trim()
  let ok = true

  nameError.value = ''
  pathError.value = ''

  if (!trimmedName) {
    nameError.value = '请输入声音名称'
    ok = false
  } else {
    const namesToCheck =
      props.mode === 'edit'
        ? props.existingNames.filter(
            (item) => item.trim().toLowerCase() !== props.initialName.trim().toLowerCase()
          )
        : props.existingNames

    if (namesToCheck.some((item) => item.trim().toLowerCase() === trimmedName.toLowerCase())) {
      nameError.value = '名称已存在'
      ok = false
    }
  }

  if (!trimmedPath) {
    pathError.value = '请选择音频文件路径'
    ok = false
  }

  return ok
}

async function pickFile(): Promise<void> {
  const picked = await window.api.pickSoundFile()
  if (!picked) return
  filePath.value = picked
  if (triedSubmit.value) {
    pathError.value = ''
  }
}

function handleCancel(): void {
  emit('cancel')
}

function handleSave(): void {
  triedSubmit.value = true
  if (!validate()) return
  emit('save', {
    name: name.value.trim(),
    path: filePath.value.trim()
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="create-sound-dialog">
      <div v-if="open" class="create-overlay" @click.self="handleCancel">
        <div
          class="create-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-sound-title"
        >
          <header class="create-header">
            <h3 id="create-sound-title" class="create-title">{{ dialogTitle }}</h3>
            <button type="button" class="create-close" aria-label="关闭" @click="handleCancel">
              <span class="icon-close"></span>
            </button>
          </header>

          <div class="create-body">
            <div class="field">
              <label class="field-label" for="create-sound-name">名称</label>
              <input
                id="create-sound-name"
                v-model="name"
                type="text"
                class="field-input"
                :class="{ error: canShowErrors && nameError }"
                spellcheck="false"
                placeholder="输入声音名称"
                @keydown.enter="handleSave"
              />
              <p v-if="canShowErrors && nameError" class="field-tip error">{{ nameError }}</p>
            </div>

            <div class="field">
              <label class="field-label" for="create-sound-path">路径</label>
              <div class="path-row">
                <input
                  id="create-sound-path"
                  v-model="filePath"
                  type="text"
                  class="field-input path-input"
                  :class="{ error: canShowErrors && pathError }"
                  spellcheck="false"
                  placeholder="选择或输入音频文件路径"
                  @keydown.enter="handleSave"
                />
                <button type="button" class="browse-btn" @click="pickFile">浏览</button>
              </div>
              <p v-if="canShowErrors && pathError" class="field-tip error">{{ pathError }}</p>
              <p v-else class="field-tip">{{ formatHint }}</p>
            </div>
          </div>

          <footer class="create-actions">
            <button type="button" class="action-btn cancel" @click="handleCancel">取消</button>
            <button type="button" class="action-btn save" @click="handleSave">保存</button>
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
  width: 520px;
  border: 1px solid rgba(212, 161, 91, 0.55);
  border-radius: 12px;
  background: linear-gradient(165deg, #24151e 0%, #2b1822 100%);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(166, 59, 75, 0.18),
    0 0 28px rgba(166, 59, 75, 0.1);
  overflow: hidden;
}

.create-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid rgba(212, 161, 91, 0.28);
}

.create-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #e3b36b;
}

.create-close {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 0.16s ease;
}

.create-close:hover {
  background: #7a2230;
}

.icon-close {
  position: relative;
  display: block;
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
  background: #d4a15b;
}

.icon-close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.icon-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.create-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
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
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.browse-btn:hover {
  color: #e3b36b;
  border-color: #d4a15b;
  background: rgba(50, 26, 37, 0.55);
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

.create-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 16px 20px 20px;
}

.action-btn {
  min-width: 76px;
  height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.action-btn.cancel {
  border: 1px solid rgba(212, 161, 91, 0.45);
  background: transparent;
  color: #a88d92;
}

.action-btn.cancel:hover {
  color: #e3b36b;
  border-color: #d4a15b;
  background: rgba(50, 26, 37, 0.55);
}

.action-btn.save {
  border: 1px solid rgba(212, 161, 91, 0.7);
  background: #a63b4b;
  color: #f7eee2;
}

.action-btn.save:hover {
  background: #b64555;
  border-color: #e3b36b;
}

.create-sound-dialog-enter-active,
.create-sound-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.create-sound-dialog-enter-active .create-dialog,
.create-sound-dialog-leave-active .create-dialog {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.create-sound-dialog-enter-from,
.create-sound-dialog-leave-to {
  opacity: 0;
}

.create-sound-dialog-enter-from .create-dialog,
.create-sound-dialog-leave-to .create-dialog {
  opacity: 0;
  transform: translateY(8px);
}
</style>

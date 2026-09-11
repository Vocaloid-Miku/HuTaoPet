<script setup lang="ts">
defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  save: []
  discard: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="unsaved-dialog">
      <div v-if="open" class="unsaved-overlay" @click.self="emit('cancel')">
        <div class="unsaved-dialog" role="alertdialog" aria-labelledby="unsaved-title">
          <div class="unsaved-body">
            <header class="unsaved-header">
              <span class="unsaved-seal" aria-hidden="true">◈</span>
              <h3 id="unsaved-title" class="unsaved-title">未保存更改</h3>
            </header>
            <p class="unsaved-message">当前内容已修改，是否保存后继续？</p>
            <footer class="unsaved-actions">
              <button type="button" class="unsaved-btn cancel" @click="emit('cancel')">
                取消
              </button>
              <button type="button" class="unsaved-btn discard" @click="emit('discard')">
                不保存
              </button>
              <button type="button" class="unsaved-btn save" @click="emit('save')">保存</button>
            </footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.unsaved-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 8, 10, 0.58);
}

.unsaved-dialog {
  position: relative;
  width: 360px;
  min-height: 180px;
  border: 1px solid #d4a15b;
  border-radius: 12px;
  background: #25161e;
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(166, 59, 75, 0.22),
    0 0 28px rgba(166, 59, 75, 0.12);
  overflow: hidden;
}

.unsaved-body {
  display: flex;
  flex-direction: column;
  min-height: 180px;
  padding: 18px 20px 20px;
  box-sizing: border-box;
}

.unsaved-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.unsaved-seal {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(212, 161, 91, 0.75);
  border-radius: 3px;
  color: #d4a15b;
  font-size: 11px;
  background: rgba(84, 35, 51, 0.5);
}

.unsaved-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #e3b36b;
}

.unsaved-message {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: rgba(234, 220, 200, 0.82);
}

.unsaved-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 24px;
}

.unsaved-btn {
  min-width: 72px;
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

.unsaved-btn.save {
  border: 1px solid #d4a15b;
  background: #a63b4b;
  color: #f7eee2;
}

.unsaved-btn.save:hover {
  background: #b64555;
  border-color: #e3b36b;
}

.unsaved-btn.discard {
  border: 1px solid rgba(212, 161, 91, 0.5);
  background: transparent;
  color: #c9b5a8;
}

.unsaved-btn.discard:hover {
  border-color: #d4a15b;
  color: #eadcc8;
  background: rgba(50, 26, 37, 0.55);
}

.unsaved-btn.cancel {
  border: 1px solid transparent;
  background: transparent;
  color: rgba(168, 141, 146, 0.9);
}

.unsaved-btn.cancel:hover {
  color: #c9b5a8;
  background: rgba(50, 26, 37, 0.35);
}

.unsaved-dialog-enter-active,
.unsaved-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.unsaved-dialog-enter-active .unsaved-dialog,
.unsaved-dialog-leave-active .unsaved-dialog {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.unsaved-dialog-enter-from,
.unsaved-dialog-leave-to {
  opacity: 0;
}

.unsaved-dialog-enter-from .unsaved-dialog,
.unsaved-dialog-leave-to .unsaved-dialog {
  opacity: 0;
  transform: translateY(10px);
}
</style>

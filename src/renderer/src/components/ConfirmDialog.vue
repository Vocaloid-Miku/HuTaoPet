<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="open" class="confirm-overlay" @click.self="emit('cancel')">
        <div class="confirm-dialog" role="alertdialog" :aria-labelledby="'confirm-title'">
          <div class="confirm-body">
            <header class="confirm-header">
              <span class="confirm-seal" aria-hidden="true">◈</span>
              <h3 id="confirm-title" class="confirm-title">{{ title }}</h3>
            </header>
            <p class="confirm-message">{{ message }}</p>
            <footer class="confirm-actions">
              <button type="button" class="confirm-btn cancel" @click="emit('cancel')">
                {{ cancelLabel || '取消' }}
              </button>
              <button type="button" class="confirm-btn ok" @click="emit('confirm')">
                {{ confirmLabel || '确定' }}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 8, 10, 0.58);
}

.confirm-dialog {
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

.confirm-body {
  display: flex;
  flex-direction: column;
  min-height: 180px;
  padding: 18px 20px 20px;
  box-sizing: border-box;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.confirm-seal {
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

.confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #e3b36b;
}

.confirm-message {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: rgba(234, 220, 200, 0.82);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 24px;
}

.confirm-btn {
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

.confirm-btn.ok {
  border: 1px solid #d4a15b;
  background: #a63b4b;
  color: #f7eee2;
}

.confirm-btn.ok:hover {
  background: #b64555;
  border-color: #e3b36b;
}

.confirm-btn.cancel {
  border: 1px solid rgba(212, 161, 91, 0.5);
  background: transparent;
  color: #c9b5a8;
}

.confirm-btn.cancel:hover {
  border-color: #d4a15b;
  color: #eadcc8;
  background: rgba(50, 26, 37, 0.55);
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-dialog-enter-active .confirm-dialog,
.confirm-dialog-leave-active .confirm-dialog {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog,
.confirm-dialog-leave-to .confirm-dialog {
  opacity: 0;
  transform: translateY(10px);
}
</style>

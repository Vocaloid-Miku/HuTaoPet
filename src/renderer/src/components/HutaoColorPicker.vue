<script setup lang="ts">
import { h, ref, type VNode } from 'vue'
import { useRecentColors } from '../composables/useRecentColors'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const pickerOpen = ref<boolean | undefined>(undefined)
const { presets, pushRecent } = useRecentColors()

/** Must sit above CreateThemeDialog overlay (z-index: 2000). */
const popupStyles = {
  popup: {
    zIndex: 3100
  }
}

function popupContainer(): HTMLElement {
  return document.body
}

function onUpdate(_color: unknown, hex: string): void {
  const next = hex.trim().toLowerCase()
  const current = props.modelValue.trim().toLowerCase()
  if (next === current) return
  emit('update:modelValue', next)
}

function handleOpenChange(next: boolean): void {
  pickerOpen.value = next
}

function confirmColor(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  pushRecent(props.modelValue)
  pickerOpen.value = false
}

function panelRender(
  _panel: VNode,
  {
    components
  }: {
    components: {
      Picker: object
      Presets: object
    }
  }
): VNode {
  const { Picker, Presets } = components
  return h('div', { class: 'hutao-cp-inner' }, [
    h(Picker),
    h(Presets),
    h('div', { class: 'hutao-cp-footer' }, [
      h(
        'button',
        {
          type: 'button',
          class: 'hutao-cp-confirm',
          onClick: confirmColor
        },
        '确定'
      )
    ])
  ])
}
</script>

<template>
  <a-color-picker
    class="hutao-cp"
    root-class-name="hutao-cp"
    :value="modelValue"
    :open="pickerOpen"
    show-text
    size="small"
    format="hex"
    :arrow="false"
    :presets="presets"
    :panel-render="panelRender"
    :get-popup-container="popupContainer"
    :styles="popupStyles"
    @open-change="handleOpenChange"
    @update:value="onUpdate"
  />
</template>

<style scoped>
.hutao-cp :deep(.ant-color-picker-trigger) {
  gap: 8px;
  min-width: 118px;
  height: 30px;
  padding: 0 8px 0 6px;
  border: 1px solid #74553a;
  border-radius: 6px;
  background: #e3d5c2;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.hutao-cp :deep(.ant-color-picker-trigger:hover) {
  border-color: #8a6645;
  background: #ebe0d0;
}

.hutao-cp :deep(.ant-color-picker-trigger-active) {
  border-color: #74553a;
  box-shadow: 0 0 0 1px rgba(116, 85, 58, 0.35);
}

.hutao-cp :deep(.ant-color-picker-color-block) {
  width: 34px;
  height: 12px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.28);
}

.hutao-cp :deep(.ant-color-picker-color-block-inner) {
  border: none;
}

.hutao-cp :deep(.ant-color-picker-trigger-text) {
  color: #a88d92;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
</style>

<!-- Popup is teleported to body; keep theme styles global under .hutao-cp / .ant-color-picker -->
<style>
/* Overlay class from @indusy/antdv-color-picker is "ant-color-picker", not always "hutao-cp". */
.hutao-cp.ant-popover,
.ant-popover.hutao-cp,
.ant-popover.ant-color-picker,
.ant-color-picker.ant-popover {
  z-index: 3100 !important;
}

.hutao-cp.ant-color-picker .ant-popover-inner,
.ant-popover.hutao-cp .ant-popover-inner,
.hutao-cp .ant-popover-inner {
  padding: 0;
  border: 1px solid #d4a15b;
  border-radius: 10px;
  background: #24151e;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38);
  overflow: hidden;
}

.hutao-cp.ant-color-picker .ant-popover-inner-content,
.ant-popover.hutao-cp .ant-popover-inner-content,
.hutao-cp .ant-popover-inner-content {
  padding: 12px;
  background: #24151e;
}

.hutao-cp .ant-color-picker-inner-content,
.hutao-cp .hutao-cp-inner {
  width: 296px;
  min-height: 248px;
  color: #eadcc8;
}

.hutao-cp .hutao-cp-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.hutao-cp .hutao-cp-inner > .ant-color-picker-select {
  order: 1;
  width: 100%;
  margin-bottom: 0;
}

.hutao-cp .hutao-cp-inner > .ant-color-picker-slider-container {
  order: 2;
  width: 100%;
}

.hutao-cp .hutao-cp-inner > .ant-color-picker-presets {
  order: 3;
  width: 100%;
}

.hutao-cp .hutao-cp-inner > .ant-color-picker-input-container {
  order: 4;
  flex: 1;
  min-width: 0;
}

.hutao-cp .hutao-cp-footer {
  order: 4;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.hutao-cp .ant-color-picker-palette {
  border-radius: 8px;
  min-height: 132px;
  background: #2c1822;
}

.hutao-cp .ant-color-picker-saturation {
  border-radius: 8px;
}

.hutao-cp .ant-color-picker-slider {
  margin-bottom: 8px;
}

.hutao-cp .ant-color-picker-slider .ant-color-picker-palette {
  min-height: 10px;
  height: 10px;
}

.hutao-cp .ant-color-picker-slider-container {
  align-items: center;
}

.hutao-cp .ant-color-picker-slider-container > .ant-color-picker-color-block {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #2c1822;
}

.hutao-cp .ant-color-picker-handler {
  width: 12px;
  height: 12px;
  border: 2px solid #f1d5ac;
  background: #d4a15b;
  box-shadow:
    0 0 0 2px rgba(166, 59, 75, 0.28),
    0 1px 4px rgba(0, 0, 0, 0.35);
}

.hutao-cp .ant-color-picker-handler-sm {
  width: 10px;
  height: 10px;
}

.hutao-cp .ant-color-picker-color-block {
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(212, 161, 91, 0.35);
}

.hutao-cp .ant-color-picker-clear {
  display: none;
}

.hutao-cp .ant-color-picker-format-select {
  display: none !important;
}

.hutao-cp .ant-color-picker-input-container {
  gap: 8px;
}

.hutao-cp .ant-color-picker-hex-input.ant-input-affix-wrapper,
.hutao-cp .ant-input-affix-wrapper,
.hutao-cp .ant-input,
.hutao-cp .ant-input-number,
.hutao-cp .ant-input-number-input {
  color: #eadcc8 !important;
  background: #2c1822 !important;
  border-color: rgba(212, 161, 91, 0.4) !important;
  box-shadow: none !important;
}

.hutao-cp .ant-input-affix-wrapper:hover,
.hutao-cp .ant-input-affix-wrapper-focused,
.hutao-cp .ant-input:focus,
.hutao-cp .ant-input-number:hover,
.hutao-cp .ant-input-number-focused {
  border-color: #e3b36b !important;
}

.hutao-cp .ant-color-picker-hex-input .ant-input-prefix {
  color: #a88d92;
  text-transform: uppercase;
  font-size: 11px;
}

.hutao-cp .ant-color-picker-alpha-input {
  display: none;
}

.hutao-cp .ant-color-picker-presets {
  margin: 0;
}

.hutao-cp .ant-color-picker-presets .ant-collapse {
  background: transparent;
  border: none;
}

.hutao-cp .ant-color-picker-presets .ant-collapse-item {
  border: none;
}

.hutao-cp .ant-color-picker-presets .ant-collapse-header {
  padding: 0 0 6px !important;
  color: #a88d92 !important;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.hutao-cp .ant-color-picker-presets .ant-collapse-expand-icon {
  display: none;
}

.hutao-cp .ant-color-picker-presets .ant-collapse-content {
  background: transparent;
  border: none;
}

.hutao-cp .ant-color-picker-presets .ant-collapse-content-box {
  padding: 0 !important;
}

.hutao-cp .ant-color-picker-presets-label {
  color: #a88d92;
}

.hutao-cp .ant-color-picker-presets-items {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow: hidden;
}

.hutao-cp .ant-color-picker-presets-color {
  position: relative;
  width: 18px !important;
  height: 18px !important;
  border-radius: 4px !important;
  border: 1px solid rgba(212, 161, 91, 0.35) !important;
  box-shadow: none !important;
}

.hutao-cp .ant-color-picker-presets-color::after {
  content: '';
  position: absolute;
  right: 2px;
  top: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(166, 59, 75, 0.85);
  box-shadow: 0 0 0 1px rgba(241, 213, 172, 0.35);
  pointer-events: none;
  opacity: 0.9;
}

.hutao-cp .ant-color-picker-presets-color:hover {
  border-color: #e3b36b !important;
}

.hutao-cp .ant-color-picker-presets-color-checked,
.hutao-cp .ant-color-picker-presets-color.ant-color-picker-presets-color-checked {
  outline: none;
  border-color: #d4a15b !important;
  box-shadow:
    0 0 0 1px #a63b4b,
    0 0 0 2px rgba(212, 161, 91, 0.55) !important;
}

.hutao-cp .hutao-cp-confirm {
  min-width: 64px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid #d4a15b;
  border-radius: 4px;
  background: #542333;
  color: #f1d5ac;
  font-size: 12px;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.hutao-cp .hutao-cp-confirm:hover {
  background: #a63b4b;
  border-color: #e3b36b;
  color: #f7eee2;
}

.hutao-cp .ant-select-dropdown {
  z-index: 3200 !important;
  background: #2c1822 !important;
  border: 1px solid rgba(212, 161, 91, 0.45);
}

.hutao-cp .ant-select-item {
  color: #eadcc8;
}

.hutao-cp .ant-select-item-option-active,
.hutao-cp .ant-select-item-option-selected {
  background: #542333 !important;
  color: #f1d5ac !important;
}

.hutao-cp .ant-divider {
  display: none;
}
</style>

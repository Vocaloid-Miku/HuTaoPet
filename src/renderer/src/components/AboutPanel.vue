<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import packageJson from '../../../../package.json'
import '../assets/font_5229559_0rclsofyzg5/iconfont.css'
import type { ThemeConfig } from '@shared/theme'

const appVersion = packageJson.version
const activeThemeLabel = ref('—')

const platformLabel = computed(() => {
  const platform = window.electron.process.platform
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return platform
})

const infoCards = computed(() => [
  { label: '当前版本', value: `v${appVersion}` },
  { label: '软件作者', value: '胡桃每日大赛' },
  { label: '主题模式', value: activeThemeLabel.value },
  { label: '运行平台', value: platformLabel.value }
])

const linkButtons = [
  {
    key: 'qq',
    label: 'QQ',
    iconClass: 'icon-QQ',
    variant: 'default' as const,
    tooltip: ['粉丝群：1107874115', '技术交流群：1107874115'],
    tooltipBridge: true
  },
  {
    key: 'github',
    label: 'GitHub',
    iconClass: 'icon-github',
    variant: 'default' as const,
    tooltip: ['点击按钮跳转'],
    url: 'https://github.com/Vocaloid-Miku/HuTaoPet'
  },
  {
    key: 'cooperation',
    label: '合作联系方式',
    iconClass: 'icon-shouji',
    variant: 'default' as const,
    tooltip: ['微信：ETHMiku', 'QQ：1491731390'],
    tooltipBridge: true
  },
  {
    key: 'docs',
    label: '文档',
    iconClass: 'icon-wendang',
    variant: 'scroll' as const,
    tooltip: ['点击按钮跳转']
  },
  {
    key: 'tip',
    label: '打赏',
    iconClass: 'icon-dashang3',
    variant: 'default' as const,
    tooltip: [
      '胡桃不需要你的打赏',
      '如果一定要打赏的话，请给软件作者b站up主 胡桃每日大赛充电'
    ],
    tooltipBridge: true
  },
  {
    key: 'bilibili',
    label: 'bilibili',
    iconClass: 'icon-bilibili',
    variant: 'default' as const,
    tooltip: ['点击按钮跳转'],
    url: 'https://space.bilibili.com/3537120218057512?spm_id_from=333.337.0.0'
  }
]

function resolveThemeLabel(config: ThemeConfig | null, activeId: string | null): string {
  if (!activeId) return '—'
  const entry = config?.themes?.[activeId]
  if (entry?.label?.trim()) return entry.label.trim()
  return activeId
}

async function loadActiveThemeLabel(): Promise<void> {
  try {
    const [config, activeId] = await Promise.all([
      window.api.getThemeConfig(),
      window.api.getActiveThemeId()
    ])
    activeThemeLabel.value = resolveThemeLabel(config, activeId)
  } catch (error) {
    console.warn('Failed to load active theme for about panel:', error)
    activeThemeLabel.value = '—'
  }
}

function handleLinkClick(item: (typeof linkButtons)[number]): void {
  if (!item.url) return
  void window.api.openExternalUrl(item.url)
}

let stopThemeListener: (() => void) | undefined

onMounted(() => {
  void loadActiveThemeLabel()
  stopThemeListener = window.api.onThemeChanged((config) => {
    activeThemeLabel.value = resolveThemeLabel(config, config.activeTheme)
  })
})

onUnmounted(() => {
  stopThemeListener?.()
})
</script>

<template>
  <section class="about-panel">
    <div class="about-identity">
      <div class="about-meta">
        <h3 class="about-name">胡桃桌宠</h3>
        <p class="about-version">Version {{ appVersion }}</p>
        <p class="about-status">
          <span class="status-dot" aria-hidden="true"></span>
          <span>运行中</span>
        </p>
      </div>
    </div>

    <div class="about-cards">
      <article v-for="card in infoCards" :key="card.label" class="info-card">
        <p class="info-card-value">{{ card.value }}</p>
        <p class="info-card-label">{{ card.label }}</p>
      </article>
    </div>

    <div class="about-links">
      <div
        v-for="item in linkButtons"
        :key="item.key"
        class="link-btn-wrap"
        :class="{
          'link-btn-wrap--bridge': item.tooltipBridge,
          'link-btn-wrap--hint': item.tooltip && !item.tooltipBridge
        }"
      >
        <button
          type="button"
          class="link-btn"
          :class="{ 'link-btn--scroll': item.variant === 'scroll' }"
          @click="handleLinkClick(item)"
        >
          <span class="link-icon" aria-hidden="true">
            <i class="iconfont" :class="item.iconClass"></i>
          </span>
          <span class="link-label">{{ item.label }}</span>
        </button>
        <div
          v-if="item.tooltip"
          class="link-tooltip"
          :class="item.tooltipBridge ? 'link-tooltip--bridge' : 'link-tooltip--hint'"
          role="tooltip"
        >
          <p v-for="(line, index) in item.tooltip" :key="index">{{ line }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 520px;
  padding: 4px 2px 28px;
}

.about-identity {
  display: flex;
  align-items: center;
}

.about-meta {
  min-width: 0;
  margin-left: 5px;
}

.about-name {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #f4e8d6;
}

.about-version {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--text-muted, #a88d92);
}

.about-status {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: rgba(168, 141, 146, 0.9);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #6dbf7a;
  box-shadow: 0 0 8px rgba(109, 191, 122, 0.55);
}

.about-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.info-card {
  min-height: 72px;
  padding: 12px 10px;
  border: 1px solid rgba(212, 161, 91, 0.38);
  border-radius: 5px;
  background: linear-gradient(165deg, rgba(84, 35, 51, 0.72), rgba(50, 26, 37, 0.88));
  box-shadow: inset 0 0 0 1px rgba(166, 59, 75, 0.15);
  text-align: center;
}

.info-card-value {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-active, #f1d5ac);
  font-variant-numeric: tabular-nums;
}

.info-card-label {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: rgba(168, 141, 146, 0.85);
}

.about-links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.link-btn-wrap {
  position: relative;
  min-width: 0;
}

.link-btn-wrap .link-btn {
  width: 100%;
}

.link-tooltip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 2;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(212, 161, 91, 0.55);
  border-radius: 5px;
  background: linear-gradient(165deg, rgba(50, 26, 37, 0.98), rgba(36, 21, 30, 0.98));
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.35),
    0 0 12px rgba(212, 161, 91, 0.12);
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  pointer-events: none;
  transition:
    opacity 0.16s ease,
    visibility 0.16s ease,
    transform 0.16s ease;
}

.link-tooltip--bridge {
  pointer-events: auto;
  user-select: text;
  cursor: text;
}

.link-tooltip--hint {
  user-select: none;
  cursor: default;
}

.link-tooltip p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.04em;
  color: var(--text-main, #eadcc8);
  white-space: normal;
  word-break: break-word;
  user-select: text;
}

.link-tooltip p + p {
  margin-top: 4px;
}

.link-btn-wrap--bridge:hover::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 72px;
  z-index: 1;
}

.link-btn-wrap--bridge:hover .link-tooltip,
.link-btn-wrap--bridge:focus-within .link-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.link-btn-wrap--hint .link-btn:hover + .link-tooltip,
.link-btn-wrap--hint .link-btn:focus-visible + .link-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.link-btn {
  height: 42px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid rgba(212, 161, 91, 0.42);
  border-radius: 5px;
  background: rgba(36, 21, 30, 0.75);
  color: var(--text-main, #eadcc8);
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.1s ease;
}

.link-btn:hover {
  border-color: var(--gold, #d4a15b);
  box-shadow: 0 0 10px rgba(212, 161, 91, 0.22);
  color: var(--text-active, #f1d5ac);
}

.link-btn:active {
  background: rgba(166, 59, 75, 0.55);
  border-color: rgba(166, 59, 75, 0.75);
  transform: translateY(1px);
}

.link-btn--scroll {
  background: linear-gradient(180deg, rgba(45, 28, 36, 0.9), rgba(36, 21, 30, 0.95));
  border-color: rgba(212, 161, 91, 0.55);
}

.link-btn--scroll .link-icon {
  border-style: dashed;
}

.link-icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(212, 161, 91, 0.35);
  border-radius: 4px;
  color: var(--gold, #d4a15b);
}

.link-icon .iconfont {
  font-size: 14px;
  line-height: 1;
  color: var(--gold, #d4a15b);
}

.link-label {
  flex: 1;
  text-align: left;
}
</style>

<script setup lang="ts">
import { useThemeStore, type Density, type ThemeMode } from '@/stores/theme'

const theme = useThemeStore()
const densities: Array<{ id: Density; label: string; hint: string }> = [
  { id: 'compact', label: '紧凑', hint: '更密的工作台' },
  { id: 'default', label: '默认', hint: '当前比例' },
  { id: 'comfortable', label: '宽松', hint: '更大留白' }
]
</script>

<template>
  <div class="appearance">
    <section class="card">
      <header>
        <h2>主题</h2>
        <p>选择工作台的颜色主题。</p>
      </header>
      <div class="segment">
        <button
          v-for="item in ([
            ['system', '跟随系统'],
            ['light', '浅色'],
            ['dark', '深色']
          ] as Array<[ThemeMode, string]> )"
          :key="item[0]"
          type="button"
          :class="{ active: theme.mode === item[0] }"
          @click="theme.set(item[0])"
        >{{ item[1] }}</button>
      </div>
    </section>

    <section class="card">
      <header>
        <h2>界面间距</h2>
        <p>调整侧栏、顶栏和对话区域的疏密。当前 {{ theme.spacingScale }}%。</p>
      </header>
      <div class="density-grid">
        <button
          v-for="item in densities"
          :key="item.id"
          type="button"
          class="density"
          :class="{ active: theme.density === item.id }"
          @click="theme.setDensity(item.id)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </div>
      <label class="slider">
        <span>自定义比例</span>
        <input
          type="range"
          min="80"
          max="130"
          step="5"
          :value="theme.spacingScale"
          @input="theme.setSpacingScale(Number(($event.target as HTMLInputElement).value))"
        />
        <em>{{ theme.spacingScale }}%</em>
      </label>
    </section>
  </div>
</template>

<style scoped>
.appearance { display: flex; flex-direction: column; gap: 16px; }
.card { padding: 22px 24px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--surface-bg); }
header { margin-bottom: 16px; }
h2 { margin: 0 0 6px; font-size: 16px; font-weight: 650; }
p { margin: 0; color: var(--text-secondary); font-size: 13px; }
.segment { display: inline-flex; padding: 3px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--panel-bg); }
.segment button { min-width: 88px; padding: 8px 14px; border: 0; border-radius: 8px; color: var(--text-secondary); background: transparent; cursor: pointer; }
.segment button.active { color: #fff; background: var(--accent); }
.density-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.density { display: flex; flex-direction: column; gap: 4px; padding: 14px 12px; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--panel-bg); text-align: left; cursor: pointer; }
.density strong { font-size: 14px; }
.density span { color: var(--text-faint); font-size: 12px; }
.density.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface-bg)); }
.slider { display: grid; grid-template-columns: auto minmax(0, 1fr) 48px; align-items: center; gap: 12px; margin-top: 16px; color: var(--text-secondary); font-size: 12px; }
.slider input { width: 100%; accent-color: var(--accent); }
.slider em { font-style: normal; text-align: right; color: var(--text-primary); }
@media (max-width: 680px) {
  .density-grid { grid-template-columns: 1fr; }
  .segment { width: 100%; }
  .segment button { flex: 1; }
}
</style>

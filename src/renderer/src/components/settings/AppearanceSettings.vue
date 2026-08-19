<script setup lang="ts">
import { useThemeStore, type ThemeMode } from '@/stores/theme'
const theme = useThemeStore()
</script>
<template>
  <section class="settings-section">
    <header><h2>外观</h2><p>选择工作台的颜色主题。</p></header>
    <el-radio-group :model-value="theme.mode" @update:model-value="theme.set($event as ThemeMode)">
      <el-radio-button value="system">跟随系统</el-radio-button>
      <el-radio-button value="light">浅色</el-radio-button>
      <el-radio-button value="dark">深色</el-radio-button>
    </el-radio-group>
  </section>
</template>
<style scoped>
.settings-section { padding: 24px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--surface-bg); }
header { margin-bottom: 20px; } h2 { margin: 0 0 7px; font-size: 17px; } p { margin: 0; color: var(--text-secondary); font-size: 13px; }
</style>

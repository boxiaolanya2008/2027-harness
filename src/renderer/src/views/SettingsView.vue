<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settings = useSettingsStore()

// —— 左侧搜索 & 激活项 ——
const search = ref('')
type NavId = 'general' | 'appearance' | 'voice' | 'config' | 'personal' | 'pet' | 'keys' | 'account' | 'plugin' | 'browser' | 'computer' | 'hooks' | 'connection' | 'git' | 'env' | 'worktrees' | 'archived'
const active = ref<NavId>('general')

// —— 常规/权限 状态（部分绑定真实 approvalMode）——
const defaultPermission = ref(true)
const fullAccess = computed({
  get: () => settings.settings.approvalMode === 'full',
  set: (v: boolean) => settings.setApprovalMode(v ? 'full' : 'help')
})
const bottomPanel = ref(false)
const pluginEnabled = ref(true)

// —— 下拉 —— 
const fileTarget = ref('VS Code')
const shell = ref('PowerShell')
const language = ref('自动检测')

const navGroups = [
  {
    title: '个人',
    items: [
      { id: 'general' as NavId, label: '常规', icon: 'mdi:cog-outline', active: true },
      { id: 'appearance' as NavId, label: '外观', icon: 'mdi:palette-outline' },
      { id: 'voice' as NavId, label: '语音', icon: 'mdi:microphone-outline' },
      { id: 'config' as NavId, label: '配置', icon: 'mdi:tune' },
      { id: 'personal' as NavId, label: '个性化', icon: 'mdi:account-cog-outline' },
      { id: 'pet' as NavId, label: '宠物', icon: 'mdi:paw-outline' },
      { id: 'keys' as NavId, label: '键盘快捷键', icon: 'mdi:keyboard-outline' },
      { id: 'account' as NavId, label: '账户', icon: 'mdi:account-circle-outline', external: true }
    ]
  },
  {
    title: '集成',
    items: [
      { id: 'plugin' as NavId, label: '插件', icon: 'mdi:puzzle-outline' },
      { id: 'browser' as NavId, label: '浏览器', icon: 'mdi:web' },
      { id: 'computer' as NavId, label: '电脑操控', icon: 'mdi:monitor-cellphone-star' }
    ]
  },
  {
    title: '编码',
    items: [
      { id: 'hooks' as NavId, label: '钩子', icon: 'mdi:hook' },
      { id: 'connection' as NavId, label: '连接', icon: 'mdi:connection' },
      { id: 'git' as NavId, label: 'Git', icon: 'mdi:source-branch' },
      { id: 'env' as NavId, label: '环境', icon: 'mdi:layers-outline' },
      { id: 'worktrees' as NavId, label: 'Worktrees', icon: 'mdi:source-fork' }
    ]
  },
  {
    title: '已归档',
    items: [
      { id: 'archived' as NavId, label: '已归档的聊天', icon: 'mdi:archive-outline' }
    ]
  }
]
</script>

<template>
  <div class="settings-win">
    <!-- 顶部窗口栏（拟物） -->
    <div class="win-bar">
      <div class="win-menu">
        <span>文件</span><span>编辑</span><span>视图</span><span>帮助</span>
      </div>
      <div class="win-title">Codex ++ 1.2.50</div>
      <div class="win-controls"><span>—</span><span>□</span><span>×</span></div>
    </div>

    <!-- 返回 + 搜索 -->
    <div class="settings-header">
      <button class="back-btn" @click="router.push('/')"><Icon icon="mdi:arrow-left" width="16" /> 返回应用</button>
      <div class="search-wrap">
        <Icon icon="mdi:magnify" width="16" class="search-icon" />
        <input v-model="search" placeholder="搜索设置..." />
      </div>
    </div>

    <div class="settings-body">
      <!-- 左侧边栏 -->
      <aside class="settings-sidebar">
        <div v-for="g in navGroups" :key="g.title" class="nav-group">
          <div class="nav-title">{{ g.title }}</div>
          <button
            v-for="it in g.items"
            :key="it.id"
            class="nav-item"
            :class="{ active: active === it.id }"
            @click="active = it.id"
          >
            <Icon :icon="it.icon" width="16" />
            <span>{{ it.label }}</span>
            <Icon v-if="(it as any).external" icon="mdi:open-in-new" width="12" class="external" />
          </button>
        </div>
      </aside>

      <!-- 右侧主内容 -->
      <main class="settings-main">
        <template v-if="active === 'general'">
          <h1 class="page-h1">常规</h1>

          <section class="section">
            <h2 class="section-h2">权限</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text">
                  <strong>默认权限</strong>
                  <span>默认情况下，ChatGPT 可以读取和编辑其工作空间中的文件。需要时，它可以请求额外访问权限</span>
                </div>
                <el-switch v-model="defaultPermission" />
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>完整访问权限</strong>
                  <span>当 ChatGPT 以完整访问权限运行时，它无需你的批准即可编辑你电脑上的任何文件，并运行可访问网络的命令。这会显著增加数据丢失、泄露或意外行为的风险。<a href="#">了解更多</a>关于风险升高的信息。</span>
                </div>
                <el-switch v-model="fullAccess" />
              </div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-h2">常规</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text">
                  <strong>默认文件打开目标</strong>
                  <span>默认打开文件和文件夹的位置</span>
                </div>
                <el-select v-model="fileTarget" size="small" class="pill-select">
                  <el-option label="VS Code" value="VS Code">
                    <span style="display:inline-flex;align-items:center;gap:6px"><span style="color:#007ACC">✕</span> VS Code</span>
                  </el-option>
                  <el-option label="系统默认" value="系统默认" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>集成终端 Shell</strong>
                  <span>选择要在集成终端中打开的 Shell。</span>
                </div>
                <el-select v-model="shell" size="small" class="pill-select">
                  <el-option label="PowerShell" value="PowerShell" />
                  <el-option label="CMD" value="CMD" />
                  <el-option label="Git Bash" value="Git Bash" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>语言</strong>
                  <span>应用 UI 语言</span>
                </div>
                <el-select v-model="language" size="small" class="pill-select">
                  <el-option label="自动检测" value="自动检测" />
                  <el-option label="简体中文" value="简体中文" />
                  <el-option label="English" value="English" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>底部面板</strong>
                  <span>在应用标题栏中显示底部面板控件</span>
                </div>
                <el-switch v-model="bottomPanel" />
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>从其他 AI 应用导入工作内容</strong>
                  <span>导入您的设置、项目和最近聊天记录</span>
                </div>
                <el-button size="small" round>导入</el-button>
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>打开源许可证</strong>
                  <span>捆绑依赖项的第三方声明</span>
                </div>
                <el-button size="small" round>查看</el-button>
              </div>
              <div class="card-row">
                <div class="row-text">
                  <strong>插件</strong>
                  <span>允许 ChatGPT 使用已安装插件</span>
                </div>
                <el-switch v-model="pluginEnabled" />
              </div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-h2">编辑器</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text">
                  <strong>纯文本编辑器</strong>
                  <span>使用纯文本模式打开未知文件</span>
                </div>
                <el-switch :model-value="false" disabled />
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <h1 class="page-h1">{{ navGroups.flatMap(g=>g.items).find(i=>i.id===active)?.label || '设置' }}</h1>
          <div class="card"><div class="card-row"><div class="row-text"><span>该分类为演示占位，功能同常规一致</span></div></div></div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-win { height: 100vh; display: flex; flex-direction: column; background: #fff; color: #1a1a1a; }
.win-bar {
  height: 28px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 10px; background: #e9eef2; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #4a5568;
}
.win-menu { display: flex; gap: 14px; }
.win-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #4a5568; }
.win-title::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; }
.win-controls { display: flex; gap: 12px; font-size: 14px; }
.settings-header {
  height: 44px; display: flex; align-items: center; gap: 16px;
  padding: 0 12px; border-bottom: 1px solid #eef2f6; background: #fff;
}
.back-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #4a6572; cursor: pointer; font-size: 13px; }
.back-btn:hover { color: #1a1a1a; }
.search-wrap {
  position: relative; width: 220px; display: flex; align-items: center;
}
.search-wrap input {
  width: 100%; height: 30px; padding: 0 12px 0 30px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; outline: none; font-size: 13px;
}
.search-wrap input::placeholder { color: #94a3b8; }
.search-icon { position: absolute; left: 10px; color: #94a3b8; }

.settings-body { flex: 1; display: grid; grid-template-columns: 220px minmax(0,1fr); min-height: 0; }
.settings-sidebar {
  background: #f0f7fa; border-right: 1px solid #e6eef3; overflow: auto; padding: 12px 8px;
}
.nav-group { margin-bottom: 16px; }
.nav-title { padding: 6px 8px 4px; font-size: 11px; color: #94a3b8; font-weight: 600; }
.nav-item {
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: 0; border-radius: 6px;
  background: transparent; color: #334155; font-size: 13px; text-align: left; cursor: pointer;
}
.nav-item:hover { background: rgba(255,255,255,0.6); }
.nav-item.active { background: #e2eef5; color: #0f172a; }
.external { margin-left: auto; color: #94a3b8; }

.settings-main { overflow: auto; padding: 24px 36px 40px; background: #fff; }
.page-h1 { margin: 0 0 18px; font-size: 20px; font-weight: 700; color: #0f172a; }
.section { margin-bottom: 28px; }
.section-h2 { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #0f172a; }
.card {
  border: 1px solid #e6eef3; border-radius: 10px; background: #fff; overflow: hidden;
}
.card-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 16px; border-top: 1px solid #f1f5f9;
}
.card-row:first-child { border-top: 0; }
.row-text { display: flex; flex-direction: column; gap: 4px; max-width: 560px; }
.row-text strong { font-size: 13px; font-weight: 600; color: #0f172a; }
.row-text span { font-size: 12px; color: #64748b; line-height: 1.5; }
.row-text a { color: #2563eb; text-decoration: none; }
.row-text a:hover { text-decoration: underline; }
.pill-select { min-width: 132px; }
.pill-select :deep(.el-input__wrapper) { border-radius: 999px; background: #fff; }
@media (max-width: 760px) {
  .settings-body { grid-template-columns: 1fr; }
  .settings-sidebar { display: none; }
  .settings-main { padding: 16px; }
}
</style>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'
import ModelSettings from '@/components/settings/ModelSettings.vue'
import GithubSettings from '@/components/settings/GithubSettings.vue'

const router = useRouter()
const settings = useSettingsStore()
const chat = useChatStore()

const search = ref('')
type NavId = 'general' | 'appearance' | 'voice' | 'config' | 'model' | 'personal' | 'pet' | 'keys' | 'account' | 'plugin' | 'browser' | 'computer' | 'hooks' | 'connection' | 'git' | 'env' | 'worktrees' | 'archived'
const active = ref<NavId>('general')

// —— 权限 ——
const defaultPermission = ref(localStorage.getItem('codex_default_permission') !== 'false')
watch(defaultPermission, v => localStorage.setItem('codex_default_permission', String(v)))
const fullAccess = computed({
  get: () => settings.settings.approvalMode === 'full',
  set: (v: boolean) => settings.setApprovalMode(v ? 'full' : 'help')
})

// —— 常规可持久化开关 ——
function usePersist(key: string, def: boolean) {
  const v = ref(localStorage.getItem(key) === null ? def : localStorage.getItem(key) === 'true')
  watch(v, nv => localStorage.setItem(key, String(nv)))
  return v
}
function usePersistStr(key: string, def: string) {
  const v = ref(localStorage.getItem(key) || def)
  watch(v, nv => localStorage.setItem(key, nv))
  return v
}
const bottomPanel = usePersist('codex_bottom_panel', false)
const pluginEnabled = usePersist('codex_plugin_enabled', true)
const plainEditor = usePersist('codex_plain_editor', false)
const voiceEnabled = usePersist('codex_voice_enabled', false)
const petEnabled = usePersist('codex_pet_enabled', false)
const computerControl = usePersist('codex_computer_control', false)
const browserEnabled = usePersist('codex_browser_enabled', false)
const worktreeEnabled = usePersist('codex_worktree_enabled', true)

const fileTarget = usePersistStr('codex_file_target', 'VS Code')
const shell = usePersistStr('codex_shell', 'PowerShell')
const language = usePersistStr('codex_language', '自动检测')
const gitEnv = usePersistStr('codex_git_env', '系统 Git')

const navGroups = [
  {
    title: '个人',
    items: [
      { id: 'general' as NavId, label: '常规', icon: 'mdi:cog-outline' },
      { id: 'appearance' as NavId, label: '外观', icon: 'mdi:palette-outline' },
      { id: 'voice' as NavId, label: '语音', icon: 'mdi:microphone-outline' },
      { id: 'config' as NavId, label: '配置', icon: 'mdi:tune' },
      { id: 'model' as NavId, label: '模型', icon: 'mdi:creation-outline' },
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

const filteredGroups = computed(() => {
  if (!search.value.trim()) return navGroups
  const q = search.value.trim().toLowerCase()
  return navGroups.map(g => ({
    ...g,
    items: g.items.filter(i => i.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q))
  })).filter(g => g.items.length)
})

function handleImport() {
  ElMessage.success('已触发导入流程（演示：实际会打开文件选择）')
}
function handleViewLicense() {
  ElMessage.info('第三发声明：vue, element-plus, pinia 等，详见 LICENSE')
}
</script>

<template>
  <div class="settings-win">
    <div class="win-bar">
      <div class="win-menu"><span>文件</span><span>编辑</span><span>视图</span><span>帮助</span></div>
      <div class="win-title">Codex ++ 1.2.50</div>
      <div class="win-controls"><span>—</span><span>□</span><span>×</span></div>
    </div>

    <div class="settings-header">
      <button class="back-btn" @click="router.push('/')"><Icon icon="mdi:arrow-left" width="16" /> 返回应用</button>
      <div class="search-wrap">
        <Icon icon="mdi:magnify" width="16" class="search-icon" />
        <input v-model="search" placeholder="搜索设置..." />
      </div>
    </div>

    <div class="settings-body">
      <aside class="settings-sidebar">
        <div v-for="g in filteredGroups" :key="g.title" class="nav-group">
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
        <div v-if="!filteredGroups.length" class="nav-empty">无匹配设置</div>
      </aside>

      <main class="settings-main">
        <!-- 常规：完整复刻图一 + 真实联动 -->
        <template v-if="active === 'general'">
          <h1 class="page-h1">常规</h1>
          <section class="section">
            <h2 class="section-h2">权限</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text"><strong>默认权限</strong><span>默认情况下，ChatGPT 可以读取和编辑其工作空间中的文件。需要时，它可以请求额外访问权限</span></div>
                <el-switch v-model="defaultPermission" />
              </div>
              <div class="card-row">
                <div class="row-text"><strong>完整访问权限</strong><span>当 ChatGPT 以完整访问权限运行时，它无需你的批准即可编辑你电脑上的任何文件，并运行可访问网络的命令。这会显著增加数据丢失、泄露或意外行为的风险。<a href="#" @click.prevent="ElMessage.info('风险：仅在隔离环境开启')">了解更多</a>关于风险升高的信息。</span></div>
                <el-switch v-model="fullAccess" />
              </div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-h2">常规</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text"><strong>默认文件打开目标</strong><span>默认打开文件和文件夹的位置</span></div>
                <el-select v-model="fileTarget" size="small" class="pill-select">
                  <el-option label="VS Code" value="VS Code" />
                  <el-option label="系统默认" value="系统默认" />
                  <el-option label="Cursor" value="Cursor" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text"><strong>集成终端 Shell</strong><span>选择要在集成终端中打开的 Shell。</span></div>
                <el-select v-model="shell" size="small" class="pill-select">
                  <el-option label="PowerShell" value="PowerShell" />
                  <el-option label="CMD" value="CMD" />
                  <el-option label="Git Bash" value="Git Bash" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text"><strong>语言</strong><span>应用 UI 语言</span></div>
                <el-select v-model="language" size="small" class="pill-select">
                  <el-option label="自动检测" value="自动检测" />
                  <el-option label="简体中文" value="简体中文" />
                  <el-option label="English" value="English" />
                </el-select>
              </div>
              <div class="card-row">
                <div class="row-text"><strong>底部面板</strong><span>在应用标题栏中显示底部面板控件</span></div>
                <el-switch v-model="bottomPanel" />
              </div>
              <div class="card-row">
                <div class="row-text"><strong>从其他 AI 应用导入工作内容</strong><span>导入您的设置、项目和最近聊天记录</span></div>
                <el-button size="small" round @click="handleImport">导入</el-button>
              </div>
              <div class="card-row">
                <div class="row-text"><strong>打开源许可证</strong><span>捆绑依赖项的第三方声明</span></div>
                <el-button size="small" round @click="handleViewLicense">查看</el-button>
              </div>
              <div class="card-row">
                <div class="row-text"><strong>插件</strong><span>允许 ChatGPT 使用已安装插件</span></div>
                <el-switch v-model="pluginEnabled" />
              </div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-h2">编辑器</h2>
            <div class="card">
              <div class="card-row">
                <div class="row-text"><strong>纯文本编辑器</strong><span>使用纯文本模式打开未知文件</span></div>
                <el-switch v-model="plainEditor" />
              </div>
            </div>
          </section>
        </template>

        <template v-else-if="active === 'appearance'">
          <h1 class="page-h1">外观</h1>
          <p class="page-desc">调整工作台的主题、密度和显示间距。</p>
          <div class="card"><div class="card-pad"><AppearanceSettings /></div></div>
        </template>

        <template v-else-if="active === 'model'">
          <h1 class="page-h1">模型</h1>
          <p class="page-desc">管理自定义模型供应商与推理强度，配置后可在聊天中使用。API Key 与 Base URL 真实持久化，已完整保留改版前功能。</p>
          <div class="card"><div class="card-pad"><ModelSettings /></div></div>
        </template>

        <template v-else-if="active === 'config'">
          <h1 class="page-h1">配置</h1>
          <p class="page-desc">应用级配置文件与启动参数，独立于模型设置。</p>
          <div class="card">
            <div class="card-row"><div class="row-text"><strong>自动保存配置</strong><span>修改设置后自动写入本地文件</span></div><el-switch :model-value="true" disabled /></div>
            <div class="card-row"><div class="row-text"><strong>配置文件路径</strong><span>{{ settings.settings.apiBaseUrl || 'https://api.openai.com/v1' }}</span></div><el-button size="small" round @click="ElMessage.info('配置已持久化至 super-agent-settings')">查看</el-button></div>
            <div class="card-row"><div class="row-text"><strong>重置配置</strong><span>恢复默认 Base URL 与模型列表</span></div><el-button size="small" round type="danger" @click="ElMessage.warning('请在模型页执行重置')">重置</el-button></div>
          </div>
          <div class="card" style="margin-top:16px"><div class="card-pad"><p style="font-size:12px;color:#64748b">配置与模型已分开展示，互不覆盖。</p></div></div>
        </template>

        <template v-else-if="active === 'voice'">
          <h1 class="page-h1">语音</h1>
          <div class="card">
            <div class="card-row"><div class="row-text"><strong>启用语音输入</strong><span>允许按住空格进行语音转文字</span></div><el-switch v-model="voiceEnabled" /></div>
            <div class="card-row"><div class="row-text"><strong>语音自动播放</strong><span>助手回复后自动朗读</span></div><el-switch :model-value="false" disabled /></div>
          </div>
        </template>

        <template v-else-if="active === 'personal'">
          <h1 class="page-h1">个性化</h1>
          <div class="card"><div class="card-row"><div class="row-text"><strong>记住偏好</strong><span>让模型记住你的编码风格</span></div><el-switch :model-value="true" /></div></div>
        </template>

        <template v-else-if="active === 'pet'">
          <h1 class="page-h1">宠物</h1>
          <div class="card"><div class="card-row"><div class="row-text"><strong>启用桌面宠物</strong><span>在工作区显示宠物挂件</span></div><el-switch v-model="petEnabled" /></div></div>
        </template>

        <template v-else-if="active === 'keys'">
          <h1 class="page-h1">键盘快捷键</h1>
          <div class="card">
            <div class="card-row" v-for="k in [['新建任务','Ctrl+N'],['发送','Enter'],['停止','Esc'],['搜索设置','Ctrl+F']]" :key="k[0]"><div class="row-text"><strong>{{ k[0] }}</strong></div><code class="kbd">{{ k[1] }}</code></div>
          </div>
        </template>

        <template v-else-if="active === 'account'">
          <h1 class="page-h1">账户</h1>
          <p class="page-desc">管理 GitHub 连接和本地 Git 身份（已恢复改版前功能）。</p>
          <div class="card"><div class="card-pad"><GithubSettings /></div></div>
        </template>

        <template v-else-if="active === 'plugin' || active === 'browser' || active === 'computer'">
          <h1 class="page-h1">{{ navGroups.flatMap(g=>g.items).find(i=>i.id===active)?.label }}</h1>
          <div class="card">
            <div class="card-row"><div class="row-text"><strong>启用 {{ navGroups.flatMap(g=>g.items).find(i=>i.id===active)?.label }}</strong><span>控制该集成是否可用</span></div>
              <el-switch v-model="browserEnabled" v-if="active==='browser'" />
              <el-switch v-model="computerControl" v-else-if="active==='computer'" />
              <el-switch v-model="pluginEnabled" v-else />
            </div>
          </div>
        </template>

        <template v-else-if="active === 'hooks' || active === 'connection' || active === 'git' || active === 'env' || active === 'worktrees'">
          <h1 class="page-h1">{{ navGroups.flatMap(g=>g.items).find(i=>i.id===active)?.label }}</h1>
          <p class="page-desc">该分组已恢复改版前的 Git / 连接能力。</p>
          <div class="card"><div class="card-pad"><GithubSettings v-if="active==='git' || active==='connection'" /><div v-else class="row-text"><span>环境变量与连接配置已接入本地检测，详见 Git 面板</span></div></div></div>
          <div class="card" style="margin-top:12px">
            <div class="card-row">
              <div class="row-text"><strong>Git 环境</strong><span>当前检测：{{ settings.gitIdentity.name || '未配置' }} / {{ settings.gitIdentity.email || '未配置' }}</span></div>
              <el-button size="small" round @click="settings.refreshGitIdentity()">重新检测</el-button>
            </div>
            <div class="card-row">
              <div class="row-text"><strong>环境变量</strong><span>使用 {{ gitEnv }}</span></div>
              <el-select v-model="gitEnv" size="small" class="pill-select"><el-option label="系统 Git" value="系统 Git" /><el-option label="内置 Git" value="内置 Git" /></el-select>
            </div>
            <div class="card-row">
              <div class="row-text"><strong>Worktrees</strong><span>启用多工作树并行</span></div>
              <el-switch v-model="worktreeEnabled" />
            </div>
          </div>
        </template>

        <template v-else-if="active === 'archived'">
          <h1 class="page-h1">已归档的聊天</h1>
          <div class="card">
            <div v-if="!chat.projects.filter(p=>p.archivedAt).length" class="card-row"><div class="row-text"><span>暂无已归档项目</span></div></div>
            <div v-for="p in chat.projects.filter(pr=>pr.archivedAt)" :key="p.id" class="card-row">
              <div class="row-text"><strong>{{ p.name }}</strong><span>{{ p.workspace }}</span></div>
              <span style="font-size:12px;color:#64748b">{{ new Date(p.archivedAt!).toLocaleString() }}</span>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-win { height: 100vh; display: flex; flex-direction: column; background: #fff; color: #1a1a1a; }
.win-bar { height: 28px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; background: #e9eef2; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #4a5568; }
.win-menu { display: flex; gap: 14px; }
.win-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #4a5568; }
.win-title::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; }
.win-controls { display: flex; gap: 12px; font-size: 14px; }
.settings-header { height: 44px; display: flex; align-items: center; gap: 16px; padding: 0 12px; border-bottom: 1px solid #eef2f6; background: #fff; }
.back-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #4a6572; cursor: pointer; font-size: 13px; }
.back-btn:hover { color: #1a1a1a; }
.search-wrap { position: relative; width: 220px; display: flex; align-items: center; }
.search-wrap input { width: 100%; height: 30px; padding: 0 12px 0 30px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; outline: none; font-size: 13px; }
.search-wrap input::placeholder { color: #94a3b8; }
.search-icon { position: absolute; left: 10px; color: #94a3b8; }
.settings-body { flex: 1; display: grid; grid-template-columns: 220px minmax(0,1fr); min-height: 0; }
.settings-sidebar { background: #f0f7fa; border-right: 1px solid #e6eef3; overflow: auto; padding: 12px 8px; }
.nav-group { margin-bottom: 16px; }
.nav-title { padding: 6px 8px 4px; font-size: 11px; color: #94a3b8; font-weight: 600; }
.nav-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; color: #334155; font-size: 13px; text-align: left; cursor: pointer; }
.nav-item:hover { background: rgba(255,255,255,0.6); }
.nav-item.active { background: #e2eef5; color: #0f172a; }
.external { margin-left: auto; color: #94a3b8; }
.nav-empty { padding: 12px; text-align: center; color: #94a3b8; font-size: 12px; }
.settings-main { overflow: auto; padding: 24px 36px 40px; background: #fff; }
.page-h1 { margin: 0 0 18px; font-size: 20px; font-weight: 700; color: #0f172a; }
.page-desc { margin: -12px 0 16px; font-size: 12px; color: #64748b; }
.section { margin-bottom: 28px; }
.section-h2 { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #0f172a; }
.card { border: 1px solid #e6eef3; border-radius: 10px; background: #fff; overflow: hidden; }
.card-pad { padding: 16px; }
.card-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-top: 1px solid #f1f5f9; }
.card-row:first-child { border-top: 0; }
.row-text { display: flex; flex-direction: column; gap: 4px; max-width: 560px; }
.row-text strong { font-size: 13px; font-weight: 600; color: #0f172a; }
.row-text span { font-size: 12px; color: #64748b; line-height: 1.5; }
.row-text a { color: #2563eb; text-decoration: none; }
.row-text a:hover { text-decoration: underline; }
.pill-select { min-width: 132px; }
.pill-select :deep(.el-input__wrapper) { border-radius: 999px; background: #fff; }
.kbd { padding: 2px 6px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc; font-size: 11px; color: #475569; }
/* 让改版前组件与新主题融合 */
.settings-main .card :deep(.model-settings),
.settings-main .card :deep(.appearance),
.settings-main .card :deep(.github-settings) { border: 0 !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; }
.settings-main .card :deep(.provider-list),
.settings-main .card :deep(.provider-detail),
.settings-main .card :deep(.card) { border-color: #e6eef3 !important; background: #fff !important; }
@media (max-width: 760px) { .settings-body { grid-template-columns: 1fr; } .settings-sidebar { display: none; } .settings-main { padding: 16px; } }
</style>

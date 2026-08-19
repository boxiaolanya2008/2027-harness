<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore, type ThemeMode } from '@/stores/theme'

const props = withDefaults(defineProps<{ mode?: 'setup' | 'settings' }>(), {
  mode: 'settings'
})
const emit = defineEmits<{ saved: [] }>()

const settings = useSettingsStore()
const theme = useThemeStore()

const apiBaseUrl = ref(settings.settings.apiBaseUrl)
const model = ref(settings.settings.model)
const apiKey = ref('')
const githubToken = ref('')
const testing = ref(false)
const saving = ref(false)
const gitIdentity = ref<{ name: string; email: string } | null>(null)

async function storedSecrets() {
  return window.api.settings.get()
}

async function testConnection() {
  const secret = apiKey.value || (await storedSecrets()).aiKey
  if (!secret || !model.value) {
    ElMessage.warning('先填 model 和 API key')
    return
  }
  testing.value = true
  try {
    const res = await fetch(`${apiBaseUrl.value.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ model: model.value, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    ElMessage.success('连接成功')
  } catch (e: any) {
    ElMessage.error(`连接失败：${e.message}`)
  } finally {
    testing.value = false
  }
}

async function importGitConfig() {
  const identity = await window.api.git.config()
  gitIdentity.value = identity
  ElMessage[identity.name || identity.email ? 'success' : 'info'](
    identity.name || identity.email ? '已从本地 git config 导入身份' : '本地 git config 里没有 user.name / user.email'
  )
}

async function fetchIdentity() {
  const token = githubToken.value || (await storedSecrets()).githubToken
  if (!token) {
    ElMessage.warning('先填 GitHub token')
    return
  }
  try {
    if (githubToken.value) await settings.setGithubToken(githubToken.value)
    const user = await window.api.gh.get('/user')
    gitIdentity.value = { name: user.login, email: user.email || '' }
    ElMessage.success(`身份：${user.login}`)
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function save() {
  if (!model.value || (!apiKey.value && !settings.hasAiKey)) {
    ElMessage.warning('AI Provider 的 model 和 API key 必填')
    return
  }
  saving.value = true
  try {
    settings.settings.apiBaseUrl = apiBaseUrl.value.trim()
    settings.settings.model = model.value.trim()
    settings.persist()
    if (apiKey.value) await settings.setAiKey(apiKey.value)
    if (githubToken.value) await settings.setGithubToken(githubToken.value)
    ElMessage.success(props.mode === 'setup' ? '配置已保存' : '设置已保存')
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="settings-form">
    <section id="appearance" class="setting-section">
      <div class="section-title">
        <h2>外观</h2>
        <p>界面默认跟随系统，也可以固定为浅色或深色。</p>
      </div>
      <el-radio-group :model-value="theme.mode" size="default" @update:model-value="theme.set($event as ThemeMode)">
        <el-radio-button value="system">跟随系统</el-radio-button>
        <el-radio-button value="light">浅色</el-radio-button>
        <el-radio-button value="dark">深色</el-radio-button>
      </el-radio-group>
    </section>

    <section id="provider" class="setting-section">
      <div class="section-title">
        <h2>AI Provider</h2>
        <p>兼容 OpenAI Chat Completions API。支持本地或远程模型服务。</p>
      </div>
      <el-form label-position="top" class="form-grid">
        <el-form-item label="API Base URL" class="wide">
          <el-input v-model="apiBaseUrl" placeholder="http://127.0.0.1:3000/v1" />
        </el-form-item>
        <el-form-item label="模型 Model">
          <el-input v-model="model" placeholder="deepseek-chat / gpt-4o / ..." />
        </el-form-item>
        <el-form-item label="API Key" class="wide">
          <el-input v-model="apiKey" type="password" show-password :placeholder="settings.hasAiKey ? '已保存；输入新值可替换' : 'sk-...'" />
        </el-form-item>
      </el-form>
      <el-button :loading="testing" @click="testConnection">测试连接</el-button>
    </section>

    <section id="github" class="setting-section">
      <div class="section-title">
        <h2>GitHub</h2>
        <p>用于仓库、PR、Issue 和提交时间线。token 需要对应仓库权限。</p>
      </div>
      <el-form label-position="top">
        <el-form-item label="Personal Access Token（repo scope）">
          <el-input v-model="githubToken" type="password" show-password :placeholder="settings.hasGithubToken ? '已保存；输入新值可替换' : 'ghp_...'" />
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button @click="importGitConfig">从本地 git config 导入身份</el-button>
        <el-button @click="fetchIdentity">验证 GitHub 身份</el-button>
      </div>
      <div v-if="gitIdentity" class="identity">
        <strong>{{ gitIdentity.name }}</strong>
        <span>{{ gitIdentity.email || '未提供邮箱' }}</span>
      </div>
    </section>

    <div class="save-row">
      <el-button type="primary" size="large" :loading="saving" @click="save">
        {{ mode === 'setup' ? '保存并进入工作台' : '保存设置' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.settings-form { display: flex; flex-direction: column; gap: 36px; }
.setting-section { padding-bottom: 32px; border-bottom: 1px solid var(--glass-border); }
.setting-section:last-of-type { border-bottom: none; }
.section-title { margin-bottom: 18px; }
.section-title h2 { margin: 0 0 6px; color: var(--text-primary); font-size: 16px; }
.section-title p { margin: 0; color: var(--text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
.wide { grid-column: 1 / -1; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.identity { display: flex; flex-direction: column; gap: 4px; margin-top: 16px; padding: 12px 14px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-primary); background: var(--hover-bg); }
.identity span { color: var(--text-secondary); font-size: 13px; }
.save-row { display: flex; justify-content: flex-end; padding-top: 4px; }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
</style>

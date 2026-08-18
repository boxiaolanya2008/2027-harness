<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import GlassCard from '@/components/GlassCard.vue'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const settings = useSettingsStore()

const apiBaseUrl = ref(settings.settings.apiBaseUrl)
const model = ref(settings.settings.model)
const embeddingModel = ref(settings.settings.embeddingModel)
const apiKey = ref('')
const githubToken = ref('')

const testing = ref(false)
const saving = ref(false)
const gitIdentity = ref<{ name: string; email: string } | null>(null)

async function testConnection() {
  if (!apiKey.value || !model.value) {
    ElMessage.warning('先填 model 和 API key')
    return
  }
  testing.value = true
  try {
    const res = await fetch(`${apiBaseUrl.value.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.value}` },
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
  if (!identity.name && !identity.email) {
    ElMessage.info('本地 git config 里没有 user.name / user.email')
  } else {
    ElMessage.success('已从本地 git config 导入身份')
  }
}

async function fetchIdentity() {
  if (!githubToken.value) {
    ElMessage.warning('先填 GitHub token')
    return
  }
  try {
    await settings.setGithubToken(githubToken.value)
    const user = await window.api.gh.get('/user')
    gitIdentity.value = { name: user.login, email: user.email || '' }
    ElMessage.success(`身份：${user.login}`)
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function save() {
  if (!model.value || !apiKey.value) {
    ElMessage.warning('AI Provider 的 model 和 API key 必填')
    return
  }
  saving.value = true
  try {
    settings.settings.apiBaseUrl = apiBaseUrl.value
    settings.settings.model = model.value
    settings.settings.embeddingModel = embeddingModel.value
    settings.persist()
    await settings.setAiKey(apiKey.value)
    if (githubToken.value) await settings.setGithubToken(githubToken.value)
    router.push('/')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="setup">
    <div class="setup-inner">
      <header class="setup-head">
        <h1>Super-Agent</h1>
        <p>2027 版 AI 编码代理。先配好模型与 GitHub，我就能动手改你的代码。</p>
      </header>

      <div class="setup-grid">
        <GlassCard class="setup-card">
          <h2>AI Provider</h2>
          <el-form label-position="top">
            <el-form-item label="API Base URL">
              <el-input v-model="apiBaseUrl" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item label="模型 Model">
              <el-input v-model="model" placeholder="gpt-4o / deepseek-chat / ..." />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input v-model="apiKey" type="password" show-password placeholder="sk-..." />
            </el-form-item>
            <el-form-item label="Embedding 模型（用于代码库检索）">
              <el-input v-model="embeddingModel" placeholder="text-embedding-3-small" />
            </el-form-item>
            <el-button :loading="testing" @click="testConnection">测试连接</el-button>
          </el-form>
        </GlassCard>

        <GlassCard class="setup-card">
          <h2>GitHub</h2>
          <el-form label-position="top">
            <el-form-item label="Personal Access Token（需 repo scope）">
              <el-input v-model="githubToken" type="password" show-password placeholder="ghp_..." />
            </el-form-item>
            <div class="btn-row">
              <el-button @click="importGitConfig">从本地 git config 导入身份</el-button>
              <el-button :disabled="!githubToken" @click="fetchIdentity">获取身份</el-button>
            </div>
            <div v-if="gitIdentity" class="identity glass-card">
              <div><strong>{{ gitIdentity.name }}</strong></div>
              <div class="muted">{{ gitIdentity.email || '（无邮箱）' }}</div>
            </div>          </el-form>
        </GlassCard>
      </div>

      <div class="setup-foot">
        <el-button type="primary" size="large" :loading="saving" @click="save">开始使用</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}
.setup-inner {
  width: 100%;
  max-width: 860px;
}
.setup-head {
  text-align: center;
  margin-bottom: var(--space-6);
}
.setup-head h1 {
  margin: 0;
  font-size: 30px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.setup-head p {
  color: var(--text-secondary);
}
.setup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-5);
}
.setup-card {
  padding: var(--space-5);
}
.setup-card h2 {
  margin-top: 0;
}
.btn-row {
  display: flex;
  gap: var(--space-2);
}
.identity {
  margin-top: var(--space-4);
  padding: var(--space-3);
}
.muted {
  color: var(--text-secondary);
}
.setup-foot {
  text-align: center;
  margin-top: var(--space-6);
}
</style>

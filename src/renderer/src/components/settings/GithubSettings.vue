<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const token = ref('')
const verifying = ref(false)

async function verify() {
  if (token.value) await settings.setGithubToken(token.value)
  if (!settings.hasGithubToken) return ElMessage.warning('请先填写 GitHub Token')
  verifying.value = true
  try {
    const user = await window.api.gh.get('/user')
    settings.githubLogin = user.login
    settings.githubAuthNote = '已通过 GitHub API 验证'
    ElMessage.success(`GitHub 身份：${user.login}`)
    token.value = ''
  } catch (error: any) {
    ElMessage.error(error.message)
  } finally {
    verifying.value = false
  }
}

async function refreshIdentity() {
  await settings.refreshGitIdentity()
  ElMessage.success('Git identity 已刷新')
}
</script>

<template>
  <section class="github-settings">
    <div class="card">
      <header>
        <h2>Personal Access Token</h2>
        <p>连接真实 GitHub 账户后，工作台可以读取仓库、PR、Issue 和提交。</p>
      </header>
      <el-form label-position="top">
        <el-form-item label="Token">
          <el-input v-model="token" type="password" show-password :placeholder="settings.hasGithubToken ? '已保存 ·••••••••，留空则保留当前值' : '输入 GitHub Token'" />
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button type="primary" :loading="verifying" @click="verify">验证 GitHub 身份</el-button>
      </div>
    </div>

    <div class="card">
      <div class="identity">
        <div>
          <strong>GitHub 连接</strong>
          <span v-if="settings.githubLogin">@{{ settings.githubLogin }}</span>
          <span v-else>未连接</span>
        </div>
        <p>{{ settings.githubAuthNote || '本地 Git 署名不等于 GitHub 登录凭据。' }}</p>
      </div>
      <div class="identity">
        <div>
          <strong>本地 Git identity</strong>
          <span v-if="settings.gitIdentity.name || settings.gitIdentity.email">已自动检测</span>
          <span v-else>未检测到</span>
        </div>
        <p>{{ settings.gitIdentity.name || '未配置 user.name' }} · {{ settings.gitIdentity.email || '未配置 user.email' }}</p>
        <el-button text size="small" @click="refreshIdentity">重新检测</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.github-settings { display: flex; flex-direction: column; gap: 16px; }
.card { padding: 22px 24px; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--surface-bg); }
header { margin-bottom: 16px; }
h2 { margin: 0 0 6px; font-size: 16px; }
p { margin: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.7; }
.identity { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.identity + .identity { border-top: 1px solid var(--glass-border); }
.identity div { display: flex; justify-content: space-between; gap: 12px; }
.identity span { color: var(--text-faint); font-size: 12px; }
.actions { display: flex; justify-content: flex-end; }
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '@/stores/chat'
import { useIndexerStore } from '@/stores/indexer'
import type { SearchHit } from '@/types'

const chat = useChatStore()
const indexer = useIndexerStore()
const query = ref('')
const workspaceName = computed(() => chat.workspace?.split(/[\\/]/).filter(Boolean).pop() || '未选择工作区')

async function pickWorkspace() {
  const path = await window.api.dialog.pickDir()
  if (!path) return
  await chat.selectWorkspace(path)
  await indexer.check(path)
}

async function buildIndex() {
  if (!chat.workspace) return
  await indexer.build(chat.workspace)
  ElMessage.success(`索引完成：${indexer.fileCount} 个文件`)
}

async function searchCodebase() {
  if (!chat.workspace || !query.value.trim()) return
  await indexer.search(chat.workspace, query.value.trim())
}

function useHit(hit: SearchHit) {
  chat.sendPrompt(`（代码库检索结果）\n文件：${hit.file}\n\n\`\`\`\n${hit.snippet.slice(0, 1600)}\n\`\`\`\n\n请结合这段代码回答我的问题。`)
}
</script>

<template>
  <section class="workspace-section">
    <div class="section-head">
      <span>工作区</span>
      <button title="选择目录" @click="pickWorkspace"><Icon icon="mdi:folder-plus-outline" width="17" /></button>
    </div>

    <div class="workspace-list">
      <button
        v-for="path in chat.workspaces"
        :key="path"
        class="workspace-row"
        :class="{ active: path === chat.workspace }"
        :title="path"
        @click="chat.selectWorkspace(path); indexer.check(path)"
      >
        <Icon icon="mdi:folder-open-outline" width="16" />
        <span>{{ path.split(/[\\/]/).filter(Boolean).pop() }}</span>
      </button>
      <button v-if="!chat.workspaces.length" class="workspace-empty" @click="pickWorkspace">
        <Icon icon="mdi:folder-plus-outline" width="16" /> 选择本地目录
      </button>
    </div>

    <template v-if="chat.workspace">
      <div class="workspace-current" :title="chat.workspace">{{ workspaceName }}</div>
      <div class="index-actions">
        <button @click="buildIndex" :disabled="indexer.indexing">
          <Icon :icon="indexer.indexing ? 'mdi:loading' : 'mdi:folder-open-outline'" width="15" />
          {{ indexer.hasIndex ? '重建索引' : '建立索引' }}
        </button>
      </div>
      <div v-if="indexer.hasIndex" class="code-search">
        <el-input v-model="query" size="small" placeholder="搜索代码库" @keyup.enter="searchCodebase">
          <template #prefix><Icon icon="mdi:magnify" width="15" /></template>
        </el-input>
        <div v-if="indexer.hits.length" class="search-hits">
          <button v-for="hit in indexer.hits.slice(0, 4)" :key="`${hit.file}-${hit.score}`" :title="hit.file" @click="useHit(hit)">
            <span>{{ hit.file }}</span>
            <small>{{ hit.snippet.replace(/\s+/g, ' ').slice(0, 70) }}</small>
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.workspace-section { padding: 16px 12px 12px; border-bottom: 1px solid var(--glass-border); }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: var(--text-secondary); font-size: 12px; font-weight: 700; }
.section-head button, .index-actions button { display: inline-flex; align-items: center; gap: 5px; border: 0; color: var(--text-secondary); background: transparent; cursor: pointer; }
.section-head button:hover, .index-actions button:hover { color: var(--accent); }
.workspace-list { display: flex; flex-direction: column; gap: 2px; max-height: 116px; overflow: auto; }
.workspace-row, .workspace-empty { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; font-size: 13px; }
.workspace-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row:hover, .workspace-empty:hover { color: var(--text-primary); background: var(--hover-bg); }
.workspace-row.active { color: var(--text-primary); background: var(--selected-bg); }
.workspace-current { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 10px 8px 6px; color: var(--text-faint); font-size: 11px; }
.index-actions { margin: 0 4px 10px; }
.index-actions button:disabled { opacity: 0.55; cursor: default; }
.code-search { padding-top: 2px; }
.search-hits { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.search-hits button { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 6px 8px; border: 0; border-radius: var(--radius-sm); color: var(--text-secondary); background: transparent; text-align: left; cursor: pointer; }
.search-hits button:hover { background: var(--hover-bg); }
.search-hits span { overflow: hidden; color: var(--accent); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.search-hits small { overflow: hidden; color: var(--text-faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
</style>

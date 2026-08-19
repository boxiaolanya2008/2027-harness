<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
const props = defineProps<{ modelValue: string; running: boolean; workspaceName: string; model: string; hasGithub: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'submit'): void; (event: 'stop'): void }>()
const value = computed({ get: () => props.modelValue, set: (next) => emit('update:modelValue', next) })
const canSubmit = computed(() => !!value.value.trim() && !props.running)
const attachmentHint = ref(false)
</script>
<template>
  <div class="composer">
    <el-input v-model="value" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" resize="none" placeholder="描述要完成的工作，或询问 GitHub…" @keydown.enter.exact.prevent="canSubmit && emit('submit')" />
    <div class="composer-foot">
      <div class="composer-context">
        <button class="composer-chip" type="button" :title="workspaceName"><Icon icon="mdi:folder-open-outline" width="15" /> {{ workspaceName }}</button>
        <span class="composer-chip"><Icon icon="mdi:creation-outline" width="15" /> {{ model || '未配置模型' }}</span>
        <span v-if="hasGithub" class="composer-chip composer-chip--status"><Icon icon="mdi:github" width="15" /> GitHub 已连接</span>
        <button class="composer-add" type="button" title="附件功能尚未接入" @click="attachmentHint = !attachmentHint"><Icon icon="mdi:plus" width="17" /></button>
        <small v-if="attachmentHint" class="composer-hint">附件功能尚未接入</small>
      </div>
      <div class="composer-actions">
        <span class="shortcut">Enter 发送</span>
        <el-button v-if="props.running" type="danger" text @click="emit('stop')">停止</el-button>
        <el-button v-else type="primary" :disabled="!canSubmit" @click="emit('submit')"><Icon icon="mdi:arrow-up" width="16" /> 发送</el-button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.composer { width: min(900px, 100%); margin: 0 auto; overflow: visible; border: 1px solid var(--glass-border); border-radius: 10px; background: var(--surface-bg); box-shadow: 0 4px 14px rgba(20,24,32,.05); transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease; }
.composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring); transform: translateY(-1px); }
.composer :deep(.el-textarea__inner) { min-height: 52px !important; padding: 13px 14px 8px; border: 0; box-shadow: none; color: var(--text-primary); background: transparent; line-height: 1.6; }
.composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px 8px 10px; color: var(--text-faint); font-size: 11px; }
.composer-context, .composer-actions { display: flex; align-items: center; gap: 6px; min-width: 0; }
.composer-chip, .composer-add { display: inline-flex; align-items: center; gap: 5px; max-width: 190px; padding: 4px 7px; overflow: hidden; border: 0; border-radius: 6px; color: var(--text-secondary); background: transparent; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.composer-chip { cursor: default; } .composer-chip--status { color: #2d9560; } .composer-add { cursor: pointer; } .composer-add:hover { color: var(--accent); background: var(--hover-bg); }
.composer-hint { position: absolute; margin-top: -72px; padding: 7px 9px; border: 1px solid var(--glass-border); border-radius: 7px; color: var(--text-secondary); background: var(--surface-bg); box-shadow: 0 5px 18px rgba(20,24,32,.12); }
.shortcut { color: var(--text-faint); } @media (max-width: 720px) { .shortcut { display: none; } .composer-chip { max-width: 125px; } }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { AssistantTurnEvent, ToolCall, ToolCallEvent, ToolResultEvent } from '@/types'
import MarkdownView from './MarkdownView.vue'
import ThinkingBlock from './ThinkingBlock.vue'
import ToolCallCard from './ToolCallCard.vue'

const props = withDefaults(defineProps<{
  events: AssistantTurnEvent[]
  streaming?: boolean
}>(), {
  streaming: false
})

const orderedEvents = computed(() => [...props.events].sort((a, b) => a.seq - b.seq))

function nextResult(event: ToolCallEvent, index: number): ToolResultEvent | undefined {
  for (let i = index + 1; i < orderedEvents.value.length; i++) {
    const candidate = orderedEvents.value[i]
    if (candidate.type === 'tool_result' && candidate.callId === event.callId) return candidate
    if (candidate.type === 'tool_call' && candidate.callId !== event.callId) return undefined
  }
  return undefined
}

function callFor(event: ToolCallEvent, index: number): ToolCall {
  let args: Record<string, unknown> = event.args || {}
  if (!event.args && event.rawArgs) {
    try {
      args = JSON.parse(event.rawArgs) as Record<string, unknown>
    } catch {
      args = { _raw: event.rawArgs }
    }
  }
  const result = nextResult(event, index)

  return {
    id: event.callId,
    name: event.name || 'unknown_tool',
    args,
    status: event.error || result?.status === 'failed' || result?.error ? 'error' : result?.status === 'succeeded' || event.phase === 'completed' ? 'done' : 'running'
  }
}

function resultFor(event: ToolCallEvent, index: number): string | undefined {
  const result = nextResult(event, index)
  return result?.error || result?.content
}

function isConsumedResult(event: AssistantTurnEvent, index: number) {
  if (event.type !== 'tool_result') return false
  for (let i = index - 1; i >= 0; i--) {
    const previous = orderedEvents.value[i]
    if (previous.type === 'tool_call' && previous.callId === event.callId) return true
    if (previous.type === 'tool_result') break
  }
  return false
}

function isLive(event: AssistantTurnEvent, index: number) {
  return props.streaming && index === orderedEvents.value.length - 1 &&
    (event.type === 'assistant_text' || event.type === 'reasoning')
}

function isErrorResult(event: ToolResultEvent) {
  return event.status === 'failed' || Boolean(event.error)
}
</script>

<template>
  <div class="turn-timeline">
    <template v-for="(event, index) in orderedEvents" :key="`${event.type}-${event.seq}`">
      <MarkdownView
        v-if="event.type === 'assistant_text'"
        :content="event.text"
        :streaming="isLive(event, index)"
      />
      <ThinkingBlock
        v-else-if="event.type === 'reasoning'"
        :content="event.text"
        :streaming="isLive(event, index)"
      />
      <ToolCallCard
        v-else-if="event.type === 'tool_call'"
        :call="callFor(event, index)"
        :raw-args="event.rawArgs"
        :result="resultFor(event, index)"
      />
      <div v-else-if="event.type === 'status'" class="turn-status" :class="`turn-status--${event.state}`">
        {{ event.error || (event.state === 'streaming' ? '正在生成' : event.state === 'completed' ? '生成完成' : event.state === 'aborted' ? '已取消' : '生成失败') }}
      </div>
      <div v-else-if="event.type === 'error'" class="turn-status turn-status--failed">{{ event.error }}</div>
      <pre
        v-else-if="event.type === 'tool_result' && !isConsumedResult(event, index)"
        class="orphan-result"
        :class="{ 'orphan-result--error': isErrorResult(event) }"
      >{{ event.error || event.content }}</pre>
    </template>
  </div>
</template>

<style scoped>
.turn-timeline {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.turn-status {
  margin: var(--space-2) 0;
  color: var(--text-faint);
  font-size: 12px;
}
.turn-status--failed {
  color: #ef6b73;
}
.orphan-result {
  margin: var(--space-2) 0;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  overflow: auto;
  white-space: pre-wrap;
  color: var(--text-secondary);
  font: 12px/1.55 'Cascadia Code', Consolas, monospace;
}
.orphan-result--error {
  border-color: rgba(239, 107, 115, 0.55);
  color: #ef6b73;
}
</style>

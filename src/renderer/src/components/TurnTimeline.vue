<script setup lang="ts">
import { computed } from 'vue'
import type { AssistantTurnEvent, ToolCall, ToolCallEvent, ToolResultEvent } from '@/types'
import MarkdownView from './MarkdownView.vue'
import ThinkingBlock from './ThinkingBlock.vue'
import ToolActivityRow from './ToolActivityRow.vue'

const props = withDefaults(defineProps<{
  events: AssistantTurnEvent[]
  streaming?: boolean
}>(), {
  streaming: false
})

// Events arrive in display order; use sequence only as a stable tie-breaker for persisted events.
const orderedEvents = computed(() => props.events
  .map((event, index) => ({ event, index }))
  .sort((a, b) => a.event.seq - b.event.seq || a.index - b.index)
  .map(({ event }) => event))

const latestResultsByCallId = computed(() => {
  const results = new Map<string, ToolResultEvent>()
  for (const event of orderedEvents.value) {
    if (event.type === 'tool_result') results.set(event.callId, event)
  }
  return results
})

function resultEventFor(event: ToolCallEvent): ToolResultEvent | undefined {
  return latestResultsByCallId.value.get(event.callId)
}

function callFor(event: ToolCallEvent): ToolCall {
  let args: Record<string, unknown> = event.args || {}
  if ((!event.args || !Object.keys(event.args).length) && event.rawArgs) {
    try {
      const parsed = JSON.parse(event.rawArgs)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>
      else args = { _raw: event.rawArgs }
    } catch {
      args = { _raw: event.rawArgs }
    }
  }
  const result = resultEventFor(event)

  return {
    id: event.callId,
    name: event.name || 'unknown_tool',
    args,
    status: event.error || result?.status === 'failed' || Boolean(result?.error) ? 'error' : result?.status === 'succeeded' || event.phase === 'completed' ? 'done' : 'running'
  }
}

function resultFor(event: ToolCallEvent): string | undefined {
  const result = resultEventFor(event)
  return result?.error ?? result?.content
}

const callIds = computed(() => new Set(orderedEvents.value
  .filter((event): event is ToolCallEvent => event.type === 'tool_call')
  .map((event) => event.callId)))

function isConsumedResult(event: AssistantTurnEvent) {
  return event.type === 'tool_result' && callIds.value.has(event.callId)
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
      <ToolActivityRow
        v-else-if="event.type === 'tool_call'"
        :call="callFor(event)"
        :raw-args="event.rawArgs"
        :result="resultFor(event)"
        :write-preview="event.writePreview"
      />
      <div v-else-if="event.type === 'status'" class="turn-status" :class="`turn-status--${event.state}`">
        {{ event.error || (event.state === 'streaming' ? '正在生成' : event.state === 'completed' ? '生成完成' : event.state === 'aborted' ? '已取消' : '生成失败') }}
      </div>
      <div v-else-if="event.type === 'error'" class="turn-status turn-status--failed">{{ event.error }}</div>
      <pre
        v-else-if="event.type === 'tool_result' && !isConsumedResult(event)"
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

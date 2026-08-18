<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const props = withDefaults(defineProps<{
  content: string
  streaming?: boolean
}>(), {
  streaming: false
})

const marked = new Marked({
  breaks: true,
  gfm: true
})

function safeLink(href: string | null | undefined) {
  if (!href) return false
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : ''
      const highlighted = language ? hljs.highlight(text, { language }).value : hljs.highlightAuto(text).value
      return `<pre><code class="hljs language-${language || 'plaintext'}">${highlighted}</code></pre>`
    },
    link({ href, title, text }) {
      if (!safeLink(href)) return text
      const label = title ? ` title="${escapeAttribute(title)}"` : ''
      return `<a href="${escapeAttribute(href)}"${label} target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  }
})

const html = ref('')
let frame: number | undefined

function render() {
  frame = undefined
  const source = props.content || ''
  const parsed = marked.parse(source) as string
  html.value = DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: [
      'a', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'input', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'summary', 'table', 'tbody', 'td', 'th',
      'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: ['checked', 'class', 'disabled', 'href', 'rel', 'start', 'target', 'title', 'type'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i
  })
}

function scheduleRender() {
  if (frame !== undefined) return
  frame = requestAnimationFrame(render)
}

watch(
  () => props.content,
  () => scheduleRender(),
  { immediate: true }
)

watch(
  () => props.streaming,
  (streaming, wasStreaming) => {
    if (wasStreaming && !streaming) {
      if (frame !== undefined) cancelAnimationFrame(frame)
      render()
    }
  }
)

onBeforeUnmount(() => {
  if (frame !== undefined) cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="md" v-html="html" />
</template>

<style scoped>
.md {
  line-height: 1.7;
  font-size: 14px;
  word-break: break-word;
}
.md :deep(p) {
  margin: 0.5em 0;
}
.md :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  overflow-x: auto;
}
.md :deep(code) {
  font-family: 'Cascadia Code', Consolas, monospace;
}
.md :deep(:not(pre) > code) {
  background: var(--hover-bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
  margin: 1em 0 0.4em;
}
.md :deep(ul),
.md :deep(ol) {
  padding-left: 1.4em;
}
.md :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.md :deep(th),
.md :deep(td) {
  padding: 0.35em 0.6em;
  border: 1px solid var(--glass-border);
}
.md :deep(a) {
  color: var(--accent);
}
</style>

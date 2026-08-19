<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import hljs from 'highlight.js'

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

const languageAliases: Record<string, string> = {
  bash: 'bash',
  c: 'c',
  'c#': 'csharp',
  'c++': 'cpp',
  cc: 'cpp',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  dockerfile: 'dockerfile',
  golang: 'go',
  go: 'go',
  html: 'xml',
  htm: 'xml',
  ini: 'ini',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  kotlin: 'kotlin',
  md: 'markdown',
  markdown: 'markdown',
  php: 'php',
  py: 'python',
  python: 'python',
  rb: 'ruby',
  rs: 'rust',
  rust: 'rust',
  sh: 'bash',
  shell: 'bash',
  sql: 'sql',
  swift: 'swift',
  toml: 'ini',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  vue: 'xml',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  zsh: 'bash'
}

function resolveLanguage(info: string | undefined) {
  const firstToken = info?.trim().split(/\s+/, 1)[0]?.toLowerCase()
  if (!firstToken) return undefined
  const language = languageAliases[firstToken] || firstToken
  return hljs.getLanguage(language) ? language : undefined
}

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = resolveLanguage(lang)
      const highlighted = hljs.highlight(text, { language: language || 'plaintext' }).value
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
  margin: 0.75em 0;
  max-width: 100%;
  padding: var(--space-3);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--code-border);
  border-radius: var(--radius-sm);
  background: var(--code-surface);
  color: var(--code-text);
}
.md :deep(code) {
  font-family: 'Cascadia Code', Consolas, monospace;
}
.md :deep(pre code.hljs) {
  display: block;
  min-width: max-content;
  padding: 0;
  overflow: visible;
  background: transparent;
  color: var(--code-text);
}
.md :deep(:not(pre) > code) {
  background: var(--code-inline-surface);
  color: var(--code-text);
  padding: 2px 6px;
  border-radius: 4px;
}
.md :deep(.hljs-comment),
.md :deep(.hljs-quote) { color: var(--code-comment); }
.md :deep(.hljs-keyword),
.md :deep(.hljs-selector-tag),
.md :deep(.hljs-subst) { color: var(--code-keyword); }
.md :deep(.hljs-number),
.md :deep(.hljs-literal),
.md :deep(.hljs-variable),
.md :deep(.hljs-template-variable),
.md :deep(.hljs-tag .hljs-attr) { color: var(--code-number); }
.md :deep(.hljs-string),
.md :deep(.hljs-doctag) { color: var(--code-string); }
.md :deep(.hljs-title),
.md :deep(.hljs-section),
.md :deep(.hljs-selector-id) { color: var(--code-title); }
.md :deep(.hljs-type),
.md :deep(.hljs-class .hljs-title) { color: var(--code-type); }
.md :deep(.hljs-attribute),
.md :deep(.hljs-name),
.md :deep(.hljs-tag) { color: var(--code-tag); }
.md :deep(.hljs-built_in),
.md :deep(.hljs-builtin-name),
.md :deep(.hljs-symbol),
.md :deep(.hljs-bullet),
.md :deep(.hljs-link) { color: var(--code-built-in); }
.md :deep(.hljs-meta) { color: var(--code-meta); }
.md :deep(.hljs-addition) { color: var(--code-addition); }
.md :deep(.hljs-deletion) { color: var(--code-deletion); }
.md :deep(.hljs-emphasis) { font-style: italic; }
.md :deep(.hljs-strong) { font-weight: 700; }
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

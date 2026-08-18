<script setup lang="ts">
import { computed } from 'vue'
import { Marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const props = defineProps<{ content: string }>()

const marked = new Marked({ breaks: true })

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : ''
      const highlighted = language ? hljs.highlight(text, { language }).value : hljs.highlightAuto(text).value
      return `<pre><code class="hljs language-${language || 'plaintext'}">${highlighted}</code></pre>`
    }
  }
})

const html = computed(() => marked.parse(props.content || ''))
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
  background: rgba(255, 255, 255, 0.1);
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
.md :deep(a) {
  color: var(--accent);
}
</style>

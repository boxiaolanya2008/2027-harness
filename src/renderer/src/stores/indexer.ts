import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchHit } from '@/types'

export const useIndexerStore = defineStore('indexer', () => {
  const indexing = ref(false)
  const hasIndex = ref(false)
  const fileCount = ref(0)
  const chunkCount = ref(0)
  const hits = ref<SearchHit[]>([])
  const searching = ref(false)

  async function build(root: string) {
    indexing.value = true
    try {
      const r = await window.api.indexer.build(root)
      fileCount.value = r.files
      chunkCount.value = r.chunks
      hasIndex.value = true
    } finally {
      indexing.value = false
    }
  }

  async function check(root: string) {
    hits.value = []
    fileCount.value = 0
    chunkCount.value = 0
    hasIndex.value = await window.api.indexer.cached(root)
  }

  async function search(root: string, query: string) {
    searching.value = true
    try {
      hits.value = await window.api.indexer.search(root, query)
    } finally {
      searching.value = false
    }
  }

  return { indexing, hasIndex, fileCount, chunkCount, hits, searching, build, check, search }
})

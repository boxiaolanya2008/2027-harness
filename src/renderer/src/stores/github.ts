import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Repo, PullRequest, Issue, Commit } from '@/types'

export const useGithubStore = defineStore('github', () => {
  const identity = ref<{ login: string; name?: string; avatar_url?: string } | null>(null)
  const repos = ref<Repo[]>([])
  const currentRepo = ref<Repo | null>(null)
  const prs = ref<PullRequest[]>([])
  const issues = ref<Issue[]>([])
  const commits = ref<Commit[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadIdentity() {
    try {
      identity.value = await window.api.gh.get('/user')
      error.value = ''
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function loadRepos() {
    loading.value = true
    try {
      repos.value = await window.api.gh.paged('/user/repos')
      error.value = ''
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function selectRepo(repo: Repo) {
    currentRepo.value = repo
    await Promise.all([loadPrs(), loadIssues(), loadCommits()])
  }

  async function loadPrs() {
    if (!currentRepo.value) return
    try {
      prs.value = await window.api.gh.paged(`/repos/${currentRepo.value.full_name}/pulls?state=all`)
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function loadIssues() {
    if (!currentRepo.value) return
    try {
      issues.value = await window.api.gh.paged(`/repos/${currentRepo.value.full_name}/issues?state=all`)
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function loadCommits() {
    if (!currentRepo.value) return
    try {
      commits.value = await window.api.gh.paged(`/repos/${currentRepo.value.full_name}/commits`)
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function createIssue(title: string, body: string) {
    if (!currentRepo.value) return
    await window.api.gh.post(`/repos/${currentRepo.value.full_name}/issues`, { title, body })
    await loadIssues()
  }

  return {
    identity,
    repos,
    currentRepo,
    prs,
    issues,
    commits,
    loading,
    error,
    loadIdentity,
    loadRepos,
    selectRepo,
    createIssue
  }
})

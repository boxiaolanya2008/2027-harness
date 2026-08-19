const extensionIcons: Record<string, string> = {
  ts: 'mdi:language-typescript', tsx: 'mdi:language-typescript', js: 'mdi:language-javascript', jsx: 'mdi:language-javascript',
  vue: 'mdi:vuejs', css: 'mdi:language-css3', scss: 'mdi:language-css3', less: 'mdi:language-css3',
  html: 'mdi:language-html5', htm: 'mdi:language-html5', json: 'mdi:code-json', yaml: 'mdi:code-json', yml: 'mdi:code-json',
  md: 'mdi:language-markdown', markdown: 'mdi:language-markdown', xml: 'mdi:xml',
  py: 'mdi:language-python', java: 'mdi:language-java', kt: 'mdi:language-kotlin', rs: 'mdi:language-rust',
  go: 'mdi:language-go', c: 'mdi:language-c', cpp: 'mdi:language-cpp', h: 'mdi:language-cpp',
  sh: 'mdi:console-line', bat: 'mdi:console-line', ps1: 'mdi:powershell',
  png: 'mdi:file-image-outline', jpg: 'mdi:file-image-outline', jpeg: 'mdi:file-image-outline', gif: 'mdi:file-image-outline', svg: 'mdi:svg',
  pdf: 'mdi:file-pdf-box', zip: 'mdi:zip-box-outline', tar: 'mdi:archive-outline',
  env: 'mdi:key-outline', lock: 'mdi:lock-outline'
}

export function fileIcon(path: string, isDirectory = false) {
  if (isDirectory) return 'mdi:folder-outline'
  const name = String(path || '').split(/[\\/]/).pop() || ''
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : ''
  return extensionIcons[extension || ''] || 'mdi:file-outline'
}

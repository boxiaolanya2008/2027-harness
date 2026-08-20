export interface SlashParseResult {
  name: string
  query: string
  rest: string
}

export function parseSlash(text: string): SlashParseResult | null {
  const match = String(text || '').match(/^\s*\/([a-z0-9-_]*)\s*([\s\S]*)$/i)
  if (!match) return null
  const query = (match[1] || '').toLowerCase()
  return { name: query, query, rest: match[2] || '' }
}

export function isSlashTrigger(text: string, cursor: number): { query: string } | null {
  const before = String(text || '').slice(0, Math.max(0, cursor))
  // Slash only triggers when the line start (ignoring leading spaces) is a slash token.
  const lineStart = before.lastIndexOf('\n') + 1
  const lineHead = before.slice(lineStart)
  const match = lineHead.match(/^\s*\/([a-z0-9-_]*)$/i)
  if (!match) return null
  return { query: (match[1] || '').toLowerCase() }
}

export function parseAtMentions(text: string): string[] {
  const value = String(text || '')
  const names = new Set<string>()
  const re = /(^|[^a-z0-9-_])@([a-z0-9][a-z0-9-_]{0,63})/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(value))) {
    names.add(match[2].toLowerCase())
  }
  return [...names]
}

export function activeAtMention(text: string, cursor: number): { query: string; start: number; end: number } | null {
  const before = String(text || '').slice(0, Math.max(0, cursor))
  const match = before.match(/(^|[^a-z0-9-_])@([a-z0-9-_]*)$/i)
  if (!match) return null
  const query = (match[2] || '').toLowerCase()
  const token = `@${match[2] || ''}`
  const start = before.length - token.length
  return { query, start, end: before.length }
}

export function stripSkillTriggers(text: string): { displayText: string; slashName: string | null; atNames: string[] } {
  const slash = parseSlash(text)
  const atNames = parseAtMentions(text)
  const displayText = slash ? slash.rest.trimStart() : text
  return { displayText, slashName: slash?.name || null, atNames }
}

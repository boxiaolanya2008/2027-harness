import { ElMessageBox } from 'element-plus'
import { assessShellCommand, type ShellRiskAssessment } from './shellSafety'

export type GuardDecision = 'allow' | 'deny' | 'blocked'

export interface GuardResult {
  decision: GuardDecision
  assessment: ShellRiskAssessment | null
}

function renderDialogContent(command: string, assessment: ShellRiskAssessment) {
  const isCritical = assessment.level === 'critical'
  const title = isCritical ? '已拦截高危命令' : '检测到高危命令'
  const levelLabel = isCritical ? '极高危（已自动拦截）' : '高危（需确认）'
  return {
    title,
    message: `${levelLabel}\n\n原因：${assessment.reason}\n匹配：${assessment.matched}\n\n命令：\n${command.slice(0, 800)}\n\n建议：${assessment.suggestion}`,
  }
}

export async function guardShellCommand(command: string): Promise<GuardResult> {
  const assessment = assessShellCommand(command)
  if (!assessment) return { decision: 'allow', assessment: null }

  if (assessment.level === 'critical') {
    const { title, message } = renderDialogContent(command, assessment)
    await ElMessageBox.alert(message, title, {
      confirmButtonText: '知道了',
      type: 'error',
      showClose: true,
    }).catch(() => undefined)
    return { decision: 'blocked', assessment }
  }

  const { title, message } = renderDialogContent(command, assessment)
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: '仍要执行',
      cancelButtonText: '取消执行',
      type: 'warning',
      showClose: true,
      distinguishCancelAndClose: true,
      confirmButtonClass: 'el-button--danger',
    })
    return { decision: 'allow', assessment }
  } catch (action: unknown) {
    void action
    return { decision: 'deny', assessment }
  }
}

export function formatBlockedMessage(assessment: ShellRiskAssessment, command: string): string {
  return `已被安全策略拦截，未执行。\n原因：${assessment.reason}\n匹配：${assessment.matched}\n命令：${command.slice(0, 400)}\n建议：${assessment.suggestion}`
}

export function formatDeniedMessage(assessment: ShellRiskAssessment, command: string): string {
  return `用户已取消执行高危命令。\n原因：${assessment.reason}\n匹配：${assessment.matched}\n命令：${command.slice(0, 400)}\n建议：${assessment.suggestion}`
}

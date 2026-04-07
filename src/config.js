import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export const DEFAULT_CONFIG = {
  version: '1.0',
  trackers: {
    primary: 'github',
    linear: { enabled: false, apiKey: '' }
  },
  notifications: {
    slack: { enabled: false, webhookUrl: '' },
    telegram: { enabled: false, chatId: '' }
  },
  team: {
    enabled: false,
    members: [],
    reviewAssignment: 'round-robin'
  },
  permissions: {
    scope: 'write',
    allowMerge: false,
    allowForceClose: false
  },
  workflow: {
    maxRetries: 3,
    loopTimeoutMinutes: 30,
    autoEscalate: true
  },
  branch: {
    pattern: '{tracker}-{issue-number}',
    tokens: { tracker: 'issues', type: 'feature', 'custom-id': '' },
    separator: '-',
    caseStyle: 'kebab-case'
  },
  extensions: {
    figma: { enabled: false, useAt: 'issue-analysis' }
  },
  github: {
    method: 'auto',
    owner: '',
    repo: ''
  },
  issue: {
    autoCreateBranch: true,
    autoCreateWorktree: false
  },
  memory: {
    enabled: true,
    dir: '.bylane/memory'
  },
  models: {
    default: 'claude-sonnet-4-6',
    orchestrator: 'claude-opus-4-6',
    'issue-agent': 'claude-opus-4-6',
    'code-agent': 'claude-sonnet-4-6',
    'test-agent': 'claude-haiku-4-5-20251001',
    'commit-agent': 'claude-haiku-4-5-20251001',
    'pr-agent': 'claude-haiku-4-5-20251001',
    'review-agent': 'claude-sonnet-4-6',
    'respond-agent': 'claude-opus-4-6',
    'notify-agent': 'claude-haiku-4-5-20251001',
    'analyze-agent': 'claude-opus-4-6'
  },
  loop: {
    mode: 'tmux',
    intervalMs: 300000,
    sessionName: 'bylane-loops'
  },
  review: {
    model: 'claude-sonnet-4-6',
    language: 'ko',
    includeModel: true,
    includeCodeExample: true,
    autoApprove: false,
    templateFile: '.bylane/templates/review-template.md',
    severityEmoji: {
      CRITICAL: '[CRITICAL]',
      HIGH: '[HIGH]',
      MEDIUM: '[MEDIUM]',
      LOW: '[LOW]'
    },
    footer: '🤖 {model} · {date}'
  }
}

export function loadConfig(dir = '.bylane') {
  const path = join(dir, 'bylane.json')
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return deepMerge({ ...DEFAULT_CONFIG }, raw)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export function getAgentModel(config, agentName) {
  return config.models?.[agentName] ?? config.models?.default ?? DEFAULT_CONFIG.models.default
}

export function saveConfig(config, dir = '.bylane') {
  const path = join(dir, 'bylane.json')
  writeFileSync(path, JSON.stringify(config, null, 2))
}

export function validateConfig(config) {
  const errors = []
  if (typeof config.workflow?.maxRetries !== 'number') {
    errors.push('workflow.maxRetries must be a number')
  }
  if (!['github', 'linear', 'both'].includes(config.trackers?.primary)) {
    errors.push('trackers.primary must be "github", "linear", or "both"')
  }
  if (!['read-only', 'write', 'full'].includes(config.permissions?.scope)) {
    errors.push('permissions.scope must be "read-only", "write", or "full"')
  }
  return errors
}

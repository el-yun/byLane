import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export const DEFAULT_CONFIG = {
  version: '1.0',
  trackers: {
    primary: 'github',
    linear: { enabled: false, apiKey: '' }
  },
  notifications: {
    slack: { enabled: false, channel: '' },
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

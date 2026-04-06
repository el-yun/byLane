#!/usr/bin/env node
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'

const { screen, header, pipeline, log, queue, status, onCleanup } = createLayout()
const poller = createPoller()

const startTime = Date.now()

onCleanup(() => poller.stop())

poller.onChange((states) => {
  const active = Object.values(states).find(s => s.status === 'in_progress')
  const workflowTitle = active
    ? (active.currentTask ?? active.agent)
    : 'Idle'

  header.update({
    workflowTitle,
    time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
  })
  pipeline.update(states)
  log.update(states)
  queue.update()
  status.update()
})

screen.render()

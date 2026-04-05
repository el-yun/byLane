#!/usr/bin/env node
import { createLayout } from './layout.js'
import { createPoller } from './poller.js'

const { screen, header, pipeline, log, queue, status, onCleanup } = createLayout()
const poller = createPoller()

let startTime = Date.now()

const clockInterval = setInterval(() => {
  header.update({
    time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
  })
}, 1000)

onCleanup(() => poller.stop())

poller.onChange((states) => {
  pipeline.update(states)
  log.update(states)
  queue.update()
  status.update()
})

screen.render()

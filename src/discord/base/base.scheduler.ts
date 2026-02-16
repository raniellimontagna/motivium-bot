import { Client } from 'discord.js'
import cron from 'node-cron'
import ck from 'chalk'
import { baseStorage } from './base.storage.js'
import { SchedulerData } from './base.types.js'

export function baseRegisterSchedulers(client: Client) {
  const { onError } = baseStorage.config.schedulers

  for (const scheduler of baseStorage.schedulers.values()) {
    cron.schedule(scheduler.cron, async () => {
      try {
        await scheduler.run(client)
      } catch (error) {
        if (onError) {
          onError(error, scheduler)
        } else {
          throw error
        }
      }
    })
  }

  const plural = (value: number) => (value > 1 ? 's' : '')
  const size = baseStorage.schedulers.size
  if (size > 0) {
    console.log(ck.green(`└ ${size} scheduler${plural(size)} successfully registered!`))
  }
}

export function baseSchedulerLog(data: SchedulerData) {
  baseStorage.loadLogs.schedulers.push(
    `${ck.yellow(`☉ ${data.name}`)} ${ck.gray('>')} ${ck.blue.underline(data.cron)} ${ck.green(`scheduler ✓`)}`,
  )
}

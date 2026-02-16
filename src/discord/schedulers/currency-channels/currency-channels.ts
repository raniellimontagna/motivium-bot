import dayjs from 'dayjs'
import { Client, Colors } from 'discord.js'

import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import { sendMessage } from '#utils'
import { logger, parseEnvList } from '#settings'
import {
  ExchangeRateResponse,
  getDollarExchangeRate,
  CoinGeckoCoin,
  getCoinData,
  Coins,
} from '#services'

dayjs.extend(utc)
dayjs.extend(timezone)

type CurrencyType = 'dollar' | 'bitcoin' | 'ethereum' | 'solana'

type ColorsType = (typeof Colors)[keyof typeof Colors]

type CurrencyConfig = {
  coin: Coins | 'dollar'
  envVar: string
  color: ColorsType
  title: string
  icon: string
  source: string
}

const currencyConfigs: Record<CurrencyType, CurrencyConfig> = {
  dollar: {
    coin: 'dollar',
    envVar: 'CURRENCY_DOLLAR_EXCHANGE_CHANNEL_IDS',
    color: Colors.Green,
    title: '💵 **Cotação do Dólar** 💵',
    icon: '💵',
    source: '[AwesomeAPI](<https://docs.awesomeapi.com.br/>)',
  },
  bitcoin: {
    coin: Coins.Bitcoin,
    envVar: 'CURRENCY_BTC_CHANNEL_IDS',
    color: Colors.Gold,
    title: '🪙 **Bitcoin** 🪙',
    icon: '🪙',
    source: '[CoinGecko](<https://www.coingecko.com/>)',
  },
  ethereum: {
    coin: Coins.Ethereum,
    envVar: 'CURRENCY_ETH_CHANNEL_IDS',
    color: Colors.Blue,
    title: '🔵 **Ethereum** 🔵',
    icon: '🔵',
    source: '[CoinGecko](<https://www.coingecko.com/>)',
  },
  solana: {
    coin: Coins.Solana,
    envVar: 'CURRENCY_SOL_CHANNEL_IDS',
    color: Colors.Purple,
    title: '🟣 **Solana** 🟣',
    icon: '🟣',
    source: '[CoinGecko](<https://www.coingecko.com/>)',
  },
}

import { createScheduler } from '#discord'

createScheduler({
  name: 'Dollar exchange rate',
  cron: '0 9-18 * * 1-5', // Every weekday at 9 AM to 6 PM
  run: (client) => scheduleCurrencyMessage(client, 'dollar'),
})

createScheduler({
  name: 'Bitcoin exchange rate',
  cron: '0 6-22/1 * * *', // Every hour from 6 AM to 10 PM
  run: (client) => scheduleCurrencyMessage(client, 'bitcoin'),
})

createScheduler({
  name: 'Ethereum exchange rate',
  cron: '0 6-22/1 * * *', // Every hour from 6 AM to 10 PM
  run: (client) => scheduleCurrencyMessage(client, 'ethereum'),
})

createScheduler({
  name: 'Solana exchange rate',
  cron: '0 6-22/1 * * *', // Every hour from 6 AM to 10 PM
  run: (client) => scheduleCurrencyMessage(client, 'solana'),
})

async function scheduleCurrencyMessage(client: Client, type: CurrencyType): Promise<void> {
  const config = currencyConfigs[type]
  const channelIds = parseEnvList(process.env[config.envVar])

  if (!channelIds.length) {
    logger.warn(`No channels found for ${type}`)
    return
  }

  const data =
    type === 'dollar' ? await getDollarExchangeRate() : await getCoinData(config.coin as Coins)
  const message = formatCurrencyMessage(type, data, config)

  await Promise.all(
    channelIds.map(async (channelId) => {
      await sendMessage({
        client,
        channelId,
        message,
        color: config.color,
      })
    }),
  )
}

function formatCurrencyMessage(
  type: CurrencyType,
  data: ExchangeRateResponse | CoinGeckoCoin,
  config: CurrencyConfig,
): string {
  const now = dayjs().tz('America/Sao_Paulo').format('dddd, [dia] D [de] MMMM [de] YYYY [às] HH:mm')
  const capitalizedNow = `-# ${now.charAt(0).toUpperCase() + now.slice(1)}`

  const value =
    type === 'dollar'
      ? `O valor do dólar no momento é: **R$ ${parseFloat((data as ExchangeRateResponse).bid)
          .toFixed(2)
          .replace('.', ',')}**`
      : `Preço em dólares: **$${(data as CoinGeckoCoin).usd.toFixed(2)}**`

  const dayVariation =
    type === 'dollar'
      ? parseFloat((data as ExchangeRateResponse).pctChange)
      : (data as CoinGeckoCoin).usd_24h_change

  const variation =
    dayVariation > 0 ? `📈 **${dayVariation.toFixed(2)}%**` : `📉 **${dayVariation.toFixed(2)}%**`
  const variationText = `Variação do dia: ${variation}`

  const font = `-# 🗞️ Fonte: ${config.source}`

  return `${capitalizedNow}\n\n${config.title}\n${value}\n${variationText}\n\n${font}`
}

import { axiosInstance } from '#libs'
import { AWESOME_API_EXCHANGE_RATE_URL, type ExchangeRateResponse } from './awesomeApiService.js'
import { logger } from '#settings'

export async function getDollarExchangeRate(): Promise<ExchangeRateResponse> {
  try {
    const response = await axiosInstance.get(`${AWESOME_API_EXCHANGE_RATE_URL}/USD-BRL`)

    if (response.data.USDBRL) {
      return response.data.USDBRL
    }

    throw new Error('Failed to fetch dollar exchange rate')
  } catch (error) {
    logger.error('Error fetching dollar exchange rate:', error)
    throw error
  }
}

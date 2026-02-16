import { axiosInstance } from '#libs'
import { logger } from '#settings'
import type { CurrentWeather, Forecast } from './weatherService.types.js'

export const weatherApiUrl = 'http://api.weatherapi.com/v1'
export const currentWeather = weatherApiUrl + '/current.json'
export const forecastWeather = weatherApiUrl + '/forecast.json'

export const getCurrentWeather = async (location: string): Promise<CurrentWeather> => {
  try {
    const response = await axiosInstance.get(currentWeather, {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        aqi: 'no',
      },
    })
    return response.data.current
  } catch (error) {
    logger.error('Error fetching current weather:', error)
    throw error
  }
}

export const getForecast = async (location: string, days: number = 3): Promise<Forecast> => {
  try {
    const response = await axiosInstance.get(forecastWeather, {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        days: days,
        aqi: 'no',
        alerts: 'no',
      },
    })
    return response.data.forecast
  } catch (error) {
    logger.error('Error fetching weather forecast:', error)
    throw error
  }
}

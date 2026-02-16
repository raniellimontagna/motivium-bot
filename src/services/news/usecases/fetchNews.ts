import { RSSNewsProvider, RSSFeed } from '../infrastructure/RSSNewsProvider.js'

const theVergeURLBase = 'https://www.theverge.com/rss'
const investingURLBase = 'https://br.investing.com/rss'
const gazetaDoPovoUrlBase = 'https://www.gazetadopovo.com.br/feed/rss'
const conexaoPoliticaUrlBase = 'https://conexaopolitica.com.br/feed'
const embrapaAgroUrlBase =
  'https://www.embrapa.br/en/noticias-rss/-/asset_publisher/HA73uEmvroGS/rss'

function createFetcher(feeds: RSSFeed[]) {
  const provider = new RSSNewsProvider(feeds)
  return () => provider.fetchNews()
}

export const getTechNews = createFetcher([
  { url: `${theVergeURLBase}/tech/index.xml`, name: 'The Verge - Tech' },
])

export const getAINews = createFetcher([
  { url: `${theVergeURLBase}/ai-artificial-intelligence/index.xml`, name: 'The Verge - AI' },
])

export const getSpaceNews = createFetcher([
  { url: `${theVergeURLBase}/space/index.xml`, name: 'The Verge - Space' },
])

export const getEconomyNews = createFetcher([
  { url: `${investingURLBase}/news_301.rss`, name: 'Investing.com - Cryptocurrency' },
  { url: `${investingURLBase}/news_14.rss`, name: 'Investing.com - Economy' },
  { url: `${investingURLBase}/news_1.rss`, name: 'Investing.com - Currency Exchange' },
  { url: `${gazetaDoPovoUrlBase}/economia.xml`, name: 'Gazeta do Povo - Economia' },
])

export const getBrazilNews = createFetcher([
  { url: `${conexaoPoliticaUrlBase}`, name: 'Conexão Política - Política' },
  { url: `${gazetaDoPovoUrlBase}/republica.xml`, name: 'Gazeta do Povo - República' },
  { url: `${gazetaDoPovoUrlBase}/opiniao.xml`, name: 'Gazeta do Povo - Opinião' },
])

export const getAgroNews = createFetcher([{ url: `${embrapaAgroUrlBase}`, name: 'Embrapa - Agro' }])

export interface StockData {
    symbol: string
    price: number
    change: number
    changePercent: number
    currency: string
}

export const getStockPrice = async (symbol: string): Promise<StockData | null> => {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        })

        const data = await res.json() as any
        const meta = data?.chart?.result?.[0]?.meta

        if (!meta) return null

        const price = meta.regularMarketPrice
        const prevClose = meta.previousClose ?? meta.chartPreviousClose
        const change = price - prevClose
        const changePercent = (change / prevClose) * 100

        return {
            symbol: symbol.toUpperCase(),
            price,
            change,
            changePercent,
            currency: meta.currency
        }
    } catch {
        return null
    }
}
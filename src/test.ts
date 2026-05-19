import { getStockPrice } from './stock'

const data = await getStockPrice('AAPL')
console.log(data)
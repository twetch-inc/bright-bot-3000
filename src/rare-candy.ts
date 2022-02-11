import axios from 'axios'
import Outpoint from './utils/outpoint'
import config from './utils/config'
import postTwetch from './post-twetch'

const sleep = (timeout) => {
	return new Promise((resolve) => setTimeout(resolve, timeout))
}

let exchangeRate = 100
let collectionIds = []

const getExchangeRate = async () => {
	while(true) {
		const { data } = await axios.get('https://cloud-functions.twetch.app/api/exchange-rate')
		if (data.price) {
			exchangeRate = data.price;
		}
		await sleep(1000 * 60 * 30) // update exchange rate
	}
}
getExchangeRate()

const updateCollectionIds = async () => {
	while (true) {
		const { data } = await axios.get('https://api.rarecandy.io/collections')
		collectionIds = data.map((e) => e.contract_address)
		await sleep(1000 * 60 * 60) // update collection ids hourly
	}
}
updateCollectionIds()

const lastSold = async (collectionId) => {
	try {
		const { data } = await axios.post(
			`https://api.rarecandy.io/collections/${collectionId}/listings?page=0&limit=16`,
			{
				order: 'DESC',
				order_by: 'created',
				min: '0',
				max: '1.7976931348623157e+308',
				status: 'bought'
			}
		)
		return data
	} catch (e) {
		console.log(e)
	}
}

const allLastSold = async () => {
	if (!collectionIds.length) {
		await sleep(2000)
	}

	const data = await Promise.all(collectionIds.map((id) => lastSold(id)))
	return data.reduce((a, e) => a.concat(e), [])
}

const main = async () => {
	let prevSold = await allLastSold()

	while (true) {
		try {
			const currentSold = await allLastSold()
			const newSold = currentSold.filter((e) => !prevSold.find((ps) => ps.id === e.id))
			prevSold = currentSold

			for (const item of newSold) {
				const metadata = item.metadata
				const bsvPrice = parseFloat((parseInt(item.total_price, 10) / 1e8).toFixed(3))
				const usdPrice = ((parseInt(item.total_price, 10) / 1e8) * exchangeRate).toFixed(0)

				const { txid, vout } = Outpoint.decode(item.outpoint)
				const description = `${metadata.title} (${item.rarity_status}) just sold for ${bsvPrice} BSV ($${usdPrice}) https://rarecandy.io/item/${item.collection}/${txid}/${vout}`
				await postTwetch(description)
			}
		} catch (e) {
			console.log(e)
		}

		await sleep(1000 * 30) // check for sales every minute
		console.log(`checking for new entries at ${new Date().toISOString()}`)
	}
}

//main();

require('dotenv').config();
const Twetch = require('@twetch/sdk');
const fetch = require('isomorphic-fetch');
const postTwetch = require('./post-twetch')

const twetch = new Twetch({
	clientIdentifier: process.env.CLIENT_IDENTIFIER,
	privateKey: process.env.BRIGHT_BOT_PRIVATE_KEY,
});

const sleep = (timeout) => {
	return new Promise((resolve) => setTimeout(resolve, timeout));
};

const lastSold = async () => {
	try {
		console.log(`checking for new entries at ${new Date().toISOString()}`);
		let res = await fetch('https://twonks.twetch.app/market/sold?orderBy=created%20desc');
		let lastSold = await res.json();
		return lastSold;
	} catch (e) {
		console.log(e);
	}
};

const main = async () => {
	let sold = await lastSold();
	let prevCount = sold.length;

	while (true) {
		try {
			sold = await lastSold();
			let count = sold.length;

			if (count > prevCount) {
				const exchangeRate = twetch.Helpers.exchangeRate.price;
				let diff = count - prevCount;
				console.log('new entries found:', diff);
				for (let i = 0; i < diff; i++) {
					let item = sold[i];
					const address = item.address;

					if (address !== '024532228a0a5679c49a8ce591474fa6e0626deb9170c287869c7fa8758763898b') {
						continue;
					}

					let txId = item.spent;
					let dolPrice, bsvPrice;
					let price = item.price;
					let currency = item.currency;
					if (currency === 'BSV') {
						bsvPrice = price;
						dolPrice = parseFloat(price * exchangeRate).toFixed(2);
					} else {
						dolPrice = price;
						bsvPrice = parseFloat(price / exchangeRate).toFixed(8);
					}
					let meta = JSON.parse(item.meta);
					let obj = JSON.parse(meta);
					let name = obj.name || obj.title;
					let number = obj.number;

					let twetchPost = `${name} just sold for ${bsvPrice} BSV / ($${dolPrice}) \nhttps://twetch.com/twonks/${txId}/0`;
					postTwetch(twetch, twetchPost);
				}
				prevCount = count;
			}
		} catch (e) {
			console.log(e);
		}

		await sleep(1000 * 60);
	}
};

main();

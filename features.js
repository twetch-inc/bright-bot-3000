require('dotenv').config();
const Twetch = require('@twetch/sdk');
const fetch = require('isomorphic-fetch');

var options = { clientIdentifier: process.env.clientIdentifier, privateKey: process.env.privKey };
const twetch = new Twetch(options);

const initTwetch = (key) => {
	let clientIdentifier = process.env.clientIdentifier;
	const twetch = new Twetch({ clientIdentifier, privateKey: key });
	return twetch;
};

const build = async (instance, content) => {
	try {
		let abiRes = await instance.build('twetch/post@0.0.1', {
			bContent: `${content}`,
		});
		const contentHash = abiRes.abi.contentHash();
		let address = instance.wallet.address();
		signature = instance.wallet.sign(contentHash);
		let output = abiRes.abi.args;
		output[output.length - 1] = signature;
		output[output.length - 2] = address;
		return { output: output, payees: abiRes.payees };
	} catch (e) {
		console.log(e);
		return null;
	}
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

const post = async (content, retries = 2) => {
	try {
		const signer = initTwetch(process.env.privKey); // can change to signing key for Twetch account
		const built = await build(signer, content);
		const funder = initTwetch(process.env.privKey);

		for (let i = 0; i < retries; i++) {
			try {
				let tx = await funder.wallet.buildTx(built.output, built.payees);
				console.log(tx.toString());
				await funder.publishRequest({
					signed_raw_tx: tx.toString(),
					action: 'twetch/post@0.0.1',
					broadcast: true,
					payParams: {
						tweetFromTwetch: true,
						hideTweetFromTwetchLink: true
					}
				});

				console.log(`TXID: ${tx.hash}`);
				return tx.hash;
			} catch (e) {
				console.log(e); // log error and try again
			}
		}
	} catch (e) {
		console.log(e);
	}
};

const sleep = (timeout) => {
	return new Promise((resolve) => setTimeout(resolve, timeout));
};

//const testPost = () => {
	//let twetchPost = `Frog Vision Goggles #330 just sold for 6.12 BSV / $916.00 \nhttps://twetch.com/twonks/b60edda8a8f7a9d2ee27614941b6b2cafc6223d777379c05c23bfffb237634a5/0`;
	//post(twetchPost);
//}

//testPost()

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

					let txId = item.txid;
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
					let twetchPost = `${name} just sold for ${bsvPrice} BSV / $ ${dolPrice} \nhttps://twetch.com/twonks/${txId}/0`;
					post(twetchPost);
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

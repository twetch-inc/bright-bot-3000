require('dotenv').config();
const Twetch = require('@twetch/sdk');
var options = { clientIdentifier: process.env.clientIdentifier, privateKey: process.env.privKey };
const twetch = new Twetch(options);
var totalFR = 0,
	totalDark = 0,
	totalAdv = 0,
	totalTW = 0,
	totalChat;
const initTwetch = (key, cliId) => {
	let clientIdentifier = cliId !== undefined ? cliId : process.env.clientIdentifier;
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
const frCount = async () => {
	let res = await twetch.query(`{
        allFeatureRequestPayments {
          totalCount
        }
    }`);
	totalFR = res.allFeatureRequestPayments.totalCount;
	console.log('Total feature request payments: ', totalFR);
	return totalFR;
};
const darkModeCount = async () => {
	let res = await twetch.query(`{
        allUsers(filter: {purchasedDarkModeAt: {isNull: false}}) {
            totalCount
        }
    }`);
	totalDark = res.allUsers.totalCount;
	console.log('Total dark mode: ', totalDark);
	return totalDark;
};
const advSearchCount = async () => {
	let res = await twetch.query(`{
        allUsers(filter: {purchasedAdvancedSearchAt: {isNull: false}}) {
            totalCount
        }
    }`);
	totalAdv = res.allUsers.totalCount;
	console.log('Total advanced search purchases: ', totalAdv);
	return totalAdv;
};
const twToTwCount = async () => {
	let res = await twetch.query(`{
        allUsers(filter: {purchasedTwetchToTweetAt: {isNull: false}}) {
            totalCount
        }
    }`);
	totalTW = res.allUsers.totalCount;
	console.log('Total twetch to tweet purchases: ', totalTW);
	return totalTW;
};
const chatCount = async () => {
	let res = await twetch.query(`{
        allUsers(filter: {purchasedChatAt: {isNull: false}}) {
          totalCount
        }
    }`);
	totalChat = res.allUsers.totalCount;
	console.log('Total Twetch Chat purchases: ', totalChat);
	return totalChat;
};
const getNewFR = async () => {
	let prevPayments = totalFR;
	try {
		totalFR = await frCount();
		let newPayments = totalFR - prevPayments;
		if (newPayments > 0) {
			let res = await twetch.query(`{
                allFeatureRequestPayments(last: ${newPayments}, orderBy: CREATED_AT_ASC) {
                    nodes {
                        userId
                        amount
                        featureRequestByFeatureRequestId {
                            id
                            title
                        }
                    }
                }
            }`);
			let funders = res.allFeatureRequestPayments.nodes;
			if (funders.length > 0) {
				for (let i = 0; i < funders.length; i++) {
					console.log(funders[i]);
					let amount = funders[i].amount;
					let usdAmount = (await twetch.bsvPrice()) * amount;
					if (usdAmount > 0.009) {
						let feature = funders[i].featureRequestByFeatureRequestId;
						let content = `Thank you @${funders[i].userId} for funding the ${
							feature.title
						} feature, we're on it!

    https://twetch.app/features${
			feature.id === '9f0da5cf-9657-42d7-b7c1-83d2d41d7c7f' ? '/mobile-app' : ''
		}`;
						if (feature.id === '6a22c362-2ad8-4221-8cb6-102d8c980559') {
							content = `Thank you @${funders[i].userId} for purchasing the first ever tokenized hat on bitcoin! We will get this shipped to you ASAP. 

Our supply is running out, get your hat before it’s too late! 👇
https://twetch.app/hat`;
							continue;
						}

						let tx = await post(content);
						if (tx && i < funders.length - 1) {
							await sleep(10000);
						}
					}
				}
			}
		}
	} catch (e) {
		console.log(e);
		return;
	}
};
const getNewAdv = async () => {
	let prevPayments = totalAdv;
	try {
		totalAdv = await advSearchCount();
		let newPayments = totalAdv - prevPayments;
		if (newPayments > 0) {
			let res = await twetch.query(`{
                allUsers(filter: {purchasedAdvancedSearchAt: {isNull: false}}, last: ${newPayments}, orderBy: PURCHASED_ADVANCED_SEARCH_AT_ASC) {
                nodes {
                    id
                }
                }
            }`);
			let funders = res.allUsers.nodes;
			if (funders.length > 0) {
				for (let i = 0; i < funders.length; i++) {
					console.log(funders[i]);
					let content = `Thank you @${funders[i].id} for purchasing Advanced Search!
                    
Get Advanced Search here 👇
https://twetch.app/settings`;
					console.log(content);
					let tx = await post(content);
					if (tx && i < funders.length - 1) {
						await sleep(10000);
					}
				}
			}
		}
	} catch (e) {
		console.log(e);
		return;
	}
};
const getNewDark = async () => {
	let prevPayments = totalDark;
	try {
		totalDark = await darkModeCount();
		let newPayments = totalDark - prevPayments;
		if (newPayments > 0) {
			let res = await twetch.query(`{
                allUsers(filter: {purchasedDarkModeAt: {isNull: false}}, last: ${newPayments}, orderBy: PURCHASED_DARK_MODE_AT_ASC) {
                nodes {
                    id
                }
                }
            }`);
			let funders = res.allUsers.nodes;
			if (funders.length > 0) {
				for (let i = 0; i < funders.length; i++) {
					console.log(funders[i]);
					let content = `Thank you @${funders[i].id} for purchasing Dark Mode!
                    
Get Dark Mode here 👇
https://twetch.app/settings`;
					console.log(content);
					let tx = await post(content);
					if (tx && i < funders.length - 1) {
						await sleep(10000);
					}
				}
			}
		}
	} catch (e) {
		console.log(e);
		return;
	}
};
const getNewTW = async () => {
	let prevPayments = totalTW;
	try {
		totalTW = await twToTwCount();
		let newPayments = totalTW - prevPayments;
		if (newPayments > 0) {
			let res = await twetch.query(`{
                allUsers(filter: {purchasedTwetchToTweetAt: {isNull: false}}, last: ${newPayments}, orderBy: PURCHASED_TWETCH_TO_TWEET_AT_ASC) {
                nodes {
                    id
                }
                }
            }`);
			let funders = res.allUsers.nodes;
			if (funders.length > 0) {
				for (let i = 0; i < funders.length; i++) {
					console.log(funders[i]);
					let content = `Thank you @${funders[i].id} for purchasing Tweet from Twetch!
                    
Get Tweet from Twetch here 👇
https://twetch.app/settings`;
					console.log(content);
					let tx = await post(content);
					if (tx && i < funders.length - 1) {
						await sleep(10000);
					}
				}
			}
		}
	} catch (e) {
		console.log(e);
		return;
	}
};
const getNewChat = async () => {
	let prevPayments = totalChat;
	try {
		totalChat = await chatCount();
		let newPayments = totalChat - prevPayments;
		if (newPayments > 0) {
			let res = await twetch.query(`{
                allUsers(filter: {purchasedChatAt: {isNull: false}}, last: ${newPayments}, orderBy: PURCHASED_CHAT_AT_ASC) {
                totalCount
                nodes {
                    id
                }
                }
            }`);
			let funders = res.allUsers.nodes;
			if (funders.length > 0) {
				for (let i = 0; i < funders.length; i++) {
					console.log(funders[i]);
					let content = `Thank you @${funders[i].id} for purchasing Twetch Chat!

    Get Twetch Chat here 👇
    https://twetch.app/chat/buy?r=3aa07813-f027-4a80-8834-4913c1a23c9d`;
					console.log(content);
					let tx = await post(content);
					if (tx && i < funders.length - 1) {
						await sleep(10000);
					}
				}
			}
		}
	} catch (e) {
		console.log(e);
		return;
	}
};
const post = async (content, retries = 2) => {
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
			});
			console.log(`TXID: ${tx.hash}`);
			return tx.hash;
		} catch (e) {
			console.log(e); // log error and try again
		}
	}
};
const sleep = (timeout) => {
	return new Promise((resolve) => setTimeout(resolve, timeout));
};
const main = async () => {
	await frCount();
	await advSearchCount();
	await darkModeCount();
	await twToTwCount();
	await chatCount();
	while (true) {
		await sleep(90000);
		await getNewFR();
		await sleep(90000);
		await getNewAdv();
		await sleep(90000);
		await getNewDark();
		await sleep(90000);
		await getNewTW();
		await sleep(90000);
		await getNewChat();
	}
};
main();

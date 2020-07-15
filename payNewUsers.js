require('dotenv').config();
const Twetch = require('@twetch/sdk');
const axios = require('axios');
var options = { clientIdentifier: '' },
	totalUsers = 0,
	prevUsers = 0;
const twetch = new Twetch(options);
var acornStack = createWallet(process.env.PRIVATE_KEY); // insert private key here
var amount = '$0.03',
	ms = 10000; // configure amounts and ms time
function createWallet(key) {
	let opts = options;
	opts.privateKey = key;
	let wallet = new twetch.wallet.constructor(opts);
	var twInstance = new Twetch(opts);
	wallet.feeb = 0.5;
	twInstance.wallet = wallet;
	twInstance.wallet.backup();
	return twInstance;
}
async function post(instance, content, reply, branch, filesURL, tweet, hide) {
	let response = await instance.publish('twetch/post@0.0.1', {
		bContent: `${content}${branch}${filesURL}`,
		mapReply: reply,
		payParams: {
			tweetFromTwetch: tweet,
			hideTweetFromTwetchLink: hide,
		},
	});
	//console.log(response.txid);
}

console.log(acornStack.wallet.address());
async function auth() {
	const token = await twetch.authenticate({ create: true });
	return token;
}
async function getNewUsers(first) {
	if (!first) {
		prevUsers = totalUsers;
	}
	let response = await twetch.query(`
    {
        allUsers {
          totalCount
        }
    }`);
	totalUsers = response.allUsers.totalCount;
	console.log(totalUsers);
	if (!first && totalUsers > prevUsers) {
		let newUsers = totalUsers - prevUsers;
		let res = await twetch.query(`{
            allUsers(last: ${newUsers}) {
              nodes {
                id
              }
            }
        }`);
		let users = res.allUsers.nodes;
		for (let i = 0; i < users.length; i++) {
			post(acornStack, `/pay @${users[i].id} ${amount} for joining Twetch!`, '', '', '');
			console.log(`/pay @${users[i].id} ${amount} for joining Twetch!`);
		}
	}
}
auth();
getNewUsers(true);
setInterval(getNewUsers, ms, false);

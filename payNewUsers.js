require('dotenv').config();
const Twetch = require('@twetch/sdk');
var options = {clientIdentifier: process.env.clientIdentifier}, totalUsers = 0, prevUsers = 0;
const twetch = new Twetch(options);
var wallet = createWallet(process.env.privKey); // insert private key here
var amount = process.env.payAmount, ms = process.env.ms; // configure amounts and ms time
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
            hideTweetFromTwetchLink: hide
        }
    });
    return response.txid;
}
async function auth() {
	const token = await twetch.authenticate({ create: true });
	return token;
}
function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout))
}
async function getNewUsers(first) {
	if (!first) {prevUsers = totalUsers}
	let response = await twetch.query(`
    {
        allUsers {
          totalCount
        }
    }`);
	totalUsers = response.allUsers.totalCount;
	console.log(totalUsers);
	if (!first && totalUsers === prevUsers) {
		let newUsers = totalUsers - prevUsers; newUsers = 3;
		let res = await twetch.query(`{
            allUsers(last: ${newUsers}) {
              nodes {
                id
              }
            }
        }`);
        let users = res.allUsers.nodes;
        for (let i = 0; i<users.length; i++){
            await checkIfPaid(users[i].id, amount);
        }
    }
}
async function checkIfPaid(userId, amount){
    let res = await twetch.query(`{
        allPosts(last: 1, filter: {bContent: {startsWith: "/pay @${userId}"}, userId: {equalTo: "15409"}}) {
          nodes {
            transaction
          }
        }
    }`); 
    let paidTx = res.allPosts.nodes[0].transaction;
    if (!paidTx){
        let txid = await post(wallet, `/pay @${userId} ${amount} for joining Twetch!`, '', '', '');
        console.log(`/pay @${users[i].id} ${amount} for joining Twetch!`, `TXID: ${txid}`);
    }
}
async function main(){
    auth();getNewUsers(true);
    while(true){
        await sleep(ms);
        await getNewUsers(false);
    }
}
main();
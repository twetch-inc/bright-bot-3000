const Twetch = require('@twetch/sdk');
const axios = require('axios');
var options = {clientIdentifier: '3aa07813-f027-4a80-8834-4913c1a23c9d'}, totalUsers = 0, prevUsers = 0;
const twetch = new Twetch(options);
var acornStack = createWallet(''); // insert private key here
var amount = "$0.03";
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
    console.log(response.txid);
}
async function auth() {
    const token = await twetch.authenticate();
    return token;
}
async function currentUserCount() {
    let response = await twetch.query(`
    {
        allUsers {
          totalCount
        }
    }`);
    totalUsers = response.allUsers.totalCount;
    console.log(totalUsers);
    return totalUsers;
}
async function getNewUsers(first) {
    if (!first){prevUsers = totalUsers}
    let response = await twetch.query(`
    {
        allUsers {
          totalCount
        }
    }`);
    totalUsers = response.allUsers.totalCount;
    console.log(totalUsers);
    if (!first && totalUsers > prevUsers){
        let newUsers = totalUsers - prevUsers;
        let res = await twetch.query(`{
            allUsers(last: ${newUsers}) {
              nodes {
                id
              }
            }
        }`);
        let users = res.allUsers.nodes;
        for (let i = 0; i<users.length; i++){
            post(acornStack, `/pay @${users[i].id} ${amount} for joining Twetch!`);
            console.log(`/pay @${users[i].id} ${amount} for joining Twetch!`);
        }
    }
}
auth();getNewUsers(true);
setInterval(getNewUsers, 10000, false);
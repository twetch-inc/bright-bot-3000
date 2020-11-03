require('dotenv').config();
const Twetch = require('@twetch/sdk');
var options = {clientIdentifier: process.env.clientIdentifier, privateKey: process.env.privKey};
const twetch = new Twetch(options);
var totalFR = 0, totalDark = 0, totalAdv = 0, totalTW = 0, totalChat;
const frCount = async() => {
    let res = await twetch.query(`{
        allFeatureRequestPayments {
          totalCount
        }
    }`);
    totalFR = res.allFeatureRequestPayments.totalCount;
    console.log('Total feature request payments: ', totalFR);
    return totalFR;
}
const darkModeCount = async() => {
    let res = await twetch.query(`{
        allUsers(filter: {purchasedDarkModeAt: {isNull: false}}) {
            totalCount
        }
    }`);
    totalDark = res.allUsers.totalCount;
    console.log('Total dark mode: ', totalDark);
    return totalDark;
}
const advSearchCount = async() => {
    let res = await twetch.query(`{
        allUsers(filter: {purchasedAdvancedSearchAt: {isNull: false}}) {
            totalCount
        }
    }`);
    totalAdv = res.allUsers.totalCount;
    console.log('Total advanced search purchases: ', totalAdv);
    return totalAdv;
}
const twToTwCount = async() => {
    let res = await twetch.query(`{
        allUsers(filter: {purchasedTwetchToTweetAt: {isNull: false}}) {
            totalCount
        }
    }`);
    totalTW = res.allUsers.totalCount;
    console.log('Total twetch to tweet purchases: ', totalTW);
    return totalTW;
}
const chatCount = async() => {
    let res = await twetch.query(`{
        allUsers(filter: {purchasedChatAt: {isNull: false}}) {
          totalCount
        }
    }`);
    totalChat = res.allUsers.totalCount;
    console.log('Total Twetch Chat purchases: ', totalChat);
    return totalChat;
}
const getNewFR = async() => {
    let prevPayments = totalFR;
    totalFR = await frCount();
    let newPayments = totalFR - prevPayments;
    if (newPayments > 0) {
        let res = await twetch.query(`{
            allFeatureRequestPayments(last: ${newPayments}, orderBy: CREATED_AT_ASC) {
                nodes {
                    userId
                    amount
                    featureRequestByFeatureRequestId {
                        title
                    }
                }
            }
        }`);
        let funders = res.allFeatureRequestPayments.nodes;
        if (funders.length > 0) {
            for (let i=0; i<funders.length; i++) {
                console.log(funders[i]);
                let amount = funders[i].amount;
                let usdAmount = await twetch.bsvPrice() * amount;
                if (usdAmount > 0.009) {
                    let feature = funders[i].featureRequestByFeatureRequestId.title;
                    let content = `Thank you @${funders[i].userId} for funding the ${feature} feature, we're on it!

https://twetch.app/features`;
                    console.log(content);
                    let tx = await post(twetch, content);
                    if (tx && i < funders.length-1) {
                        await sleep(10000);
                    }
                }
            }
        }
    }
}
const getNewAdv = async() => {
    let prevPayments = totalAdv;
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
            for (let i=0; i<funders.length; i++) {
                console.log(funders[i]);
                let content = `Thank you @${funders[i].id} for purchasing Advanced Search!`;
                console.log(content);
                let tx = await post(twetch, content);
                if (tx && i < funders.length-1) {
                    await sleep(10000);
                }
            }
        }
    }
}
const getNewDark = async() => {
    let prevPayments = totalDark;
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
            for (let i=0; i<funders.length; i++) {
                console.log(funders[i]);
                let content = `Thank you @${funders[i].id} for purchasing Dark Mode!`;
                console.log(content);
                let tx = await post(twetch, content);
                if (tx && i < funders.length-1) {
                    await sleep(10000);
                }
            }
        }
    }
}
const getNewTW = async() => {
    let prevPayments = totalTW;
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
            for (let i=0; i<funders.length; i++) {
                console.log(funders[i]);
                let content = `Thank you @${funders[i].id} for purchasing Tweet from Twetch!`;
                console.log(content);
                let tx = await post(twetch, content);
                if (tx && i < funders.length-1) {
                    await sleep(10000);
                }
            }
        }
    }
}
const getNewChat = async() => {
    let prevPayments = totalChat;
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
            for (let i=0; i<funders.length; i++) {
                console.log(funders[i]);
                let content = `Thank you @${funders[i].id} for purchasing Twetch Chat!

Get Twetch Chat here 👇
https://twetch.app/chat/buy?r=3aa07813-f027-4a80-8834-4913c1a23c9d`;
                console.log(content);
                let tx = await post(twetch, content);
                if (tx && i < funders.length-1) {
                    await sleep(10000);
                }
            }
        }
    }
}
const post = async(instance, content, retries = 2) => {
    for (let i = 0; i < retries; i++) {
        try {
            let response = await instance.publish('twetch/post@0.0.1', {
                bContent: `${content}`
            });
            console.log('txid: ', response.txid);
            return response.txid;
        }
        catch (e) {
            console.log(e); // log error and try again
        }
    }
}
const sleep = (timeout) => {
    return new Promise(resolve => setTimeout(resolve, timeout))
}
const main = async() => {
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
}
main();
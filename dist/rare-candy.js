"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const outpoint_1 = __importDefault(require("./utils/outpoint"));
const post_twetch_1 = __importDefault(require("./post-twetch"));
const sleep = (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};
let exchangeRate = 100;
let collectionIds = [];
const getExchangeRate = () => __awaiter(void 0, void 0, void 0, function* () {
    while (true) {
        const { data } = yield axios_1.default.get('https://cloud-functions.twetch.app/api/exchange-rate');
        if (data.price) {
            exchangeRate = data.price;
        }
        yield sleep(1000 * 60 * 30); // update exchange rate
    }
});
getExchangeRate();
const updateCollectionIds = () => __awaiter(void 0, void 0, void 0, function* () {
    while (true) {
        const { data } = yield axios_1.default.get('https://api.rarecandy.io/collections');
        collectionIds = data.map((e) => e.contract_address);
        yield sleep(1000 * 60 * 60); // update collection ids hourly
    }
});
updateCollectionIds();
const lastSold = (collectionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = yield axios_1.default.post(`https://api.rarecandy.io/collections/${collectionId}/listings?page=0&limit=16`, {
            order: 'DESC',
            order_by: 'created',
            min: '0',
            max: '1.7976931348623157e+308',
            status: 'bought'
        });
        return data;
    }
    catch (e) {
        console.log(e);
    }
});
const allLastSold = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!collectionIds.length) {
        yield sleep(2000);
    }
    const data = yield Promise.all(collectionIds.map((id) => lastSold(id)));
    return data.reduce((a, e) => a.concat(e), []);
});
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    let prevSold = yield allLastSold();
    while (true) {
        try {
            const currentSold = yield allLastSold();
            const newSold = currentSold.filter((e) => !prevSold.find((ps) => ps.id === e.id));
            prevSold = currentSold;
            for (const item of newSold) {
                const metadata = item.metadata;
                const bsvPrice = parseFloat((parseInt(item.total_price, 10) / 1e8).toFixed(3));
                const usdPrice = ((parseInt(item.total_price, 10) / 1e8) * exchangeRate).toFixed(0);
                const { txid, vout } = outpoint_1.default.decode(item.outpoint);
                const description = `${metadata.title} (${item.rarity_status}) just sold for ${bsvPrice} BSV ($${usdPrice}) https://rarecandy.io/item/${item.collection}/${txid}/${vout}`;
                yield (0, post_twetch_1.default)(description);
            }
        }
        catch (e) {
            console.log(e);
        }
        yield sleep(1000 * 30); // check for sales every minute
        console.log(`checking for new entries at ${new Date().toISOString()}`);
    }
});
//main();
//# sourceMappingURL=rare-candy.js.map
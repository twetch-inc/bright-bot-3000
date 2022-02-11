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
const config_1 = __importDefault(require("./utils/config"));
const twetch_wallet_1 = __importDefault(require("./utils/twetch-wallet"));
const wallet = new twetch_wallet_1.default(config_1.default.metasync.seed, config_1.default.metasync.paymail);
const postTwetch = (content) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield wallet._run_legacy_action({
            action: 'twetch/post@0.0.1',
            payParams: {
                tweetFromTwetch: true,
                hideTweetFromTwetchLink: true
            },
            args: {
                bContent: content,
                bFilename: `twetch_twtext_${new Date().getTime()}.txt`,
                type: 'post',
                mapReply: 'null',
                mapTwdata: 'null'
            }
        });
        console.log(result);
    }
    catch (e) {
        console.log(e);
    }
});
exports.default = postTwetch;
//# sourceMappingURL=post-twetch.js.map
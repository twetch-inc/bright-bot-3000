"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    metasync: {
        url: process.env.METASYNC_URL || 'https://metasync.twetch.app',
        seed: process.env.SEED,
        paymail: process.env.PAYMAIL
    },
    authToken: process.env.AUTH_TOKEN,
    apiUrl: 'https://api.twetch.app'
};
exports.default = config;
//# sourceMappingURL=config.js.map
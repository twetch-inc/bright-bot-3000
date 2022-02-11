"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const outpoint = {
    encode: (txid, vout) => {
        const voutBuf = Buffer.allocUnsafe(4);
        voutBuf.writeInt32LE(vout, 0);
        const outpoint = Buffer.concat([Buffer.from(txid, 'hex').reverse(), voutBuf]).toString('hex');
        return outpoint;
    },
    decode: (outpoint) => {
        const buf = Buffer.from(outpoint, 'hex');
        const txid = buf.slice(0, 32).reverse().toString('hex');
        const vout = buf.slice(32, 36).readInt32LE(0);
        return {
            txid,
            vout
        };
    }
};
exports.default = outpoint;
//# sourceMappingURL=outpoint.js.map
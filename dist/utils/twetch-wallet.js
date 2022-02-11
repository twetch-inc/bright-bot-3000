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
const config_1 = __importDefault(require("./config"));
const abi_1 = __importDefault(require("./abi"));
const bsv_wasm_1 = require("bsv-wasm");
class TwetchWallet {
    constructor(seed, paymail) {
        this.seed = seed;
        this.paymail = paymail;
    }
    _publish(action, rawtx, payParams) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield axios_1.default.post(`${config_1.default.apiUrl}/v1/publish`, {
                    broadcast: true,
                    action,
                    signed_raw_tx: rawtx,
                    payParams
                }, {
                    headers: {
                        Authorization: `Bearer ${config_1.default.authToken}`
                    }
                });
                return data;
            }
            catch (e) {
                console.log((_c = (_b = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.errors) === null || _c === void 0 ? void 0 : _c.length);
                if ((_f = (_e = (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.errors) === null || _f === void 0 ? void 0 : _f.length) {
                    throw new Error(`Publish Error: ${e.response.data.errors.join(', ')}`);
                }
                throw new Error(`Publish Error: ${e.message}`);
            }
        });
    }
    _fetchPayees(action, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.post(`${config_1.default.apiUrl}/v1/payees`, {
                args,
                action,
                client_identifier: '1325c30a-7eb3-4169-a6f4-330eeeb8ca49',
                payload: {
                    resolveChange: true
                }
            }, {
                headers: {
                    Authorization: `Bearer ${config_1.default.authToken}`
                }
            });
            return data;
        });
    }
    _broadcast(rawtx) {
        return __awaiter(this, void 0, void 0, function* () {
            yield axios_1.default.post(`${config_1.default.metasync.url}/tx`, {
                metadata: { sender: this.paymail },
                hex: rawtx
            });
        });
    }
    _derive(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return bsv_wasm_1.ExtendedPrivateKey.fromMnemonic(Buffer.from(this.seed, 'utf8'), null).derive(path);
        });
    }
    _xpriv_wallet() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._derive(`m/44'/0'/0'/0`);
        });
    }
    _xpriv_account() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._derive(`m/0/0`);
        });
    }
    _address_account() {
        return __awaiter(this, void 0, void 0, function* () {
            const xpriv = yield this._xpriv_account();
            return xpriv.getPublicKey().toAddress();
        });
    }
    _resolve_change_address() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.post(`${config_1.default.metasync.url}/paymail/p2p-payment-destination/${this.paymail}`, {
                satoshis: 0
            });
            return bsv_wasm_1.Script.fromHex((_b = (_a = data === null || data === void 0 ? void 0 : data.outputs) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.script);
        });
    }
    _run_legacy_action(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const { action, args, payParams, resolveChange } = props;
            const me = 1;
            const exchangeRate = 100;
            const outputs = [];
            let changeAddress;
            let isTrollToll;
            if (action) {
                const abi = new abi_1.default().action(action).fromObject(args);
                const { payees, invoice } = yield this._fetchPayees(action, abi.toArray());
                isTrollToll = !!payees.find((e) => { var _a; return (_a = e === null || e === void 0 ? void 0 : e.types) === null || _a === void 0 ? void 0 : _a.includes('troll-toll'); });
                abi.replace('#{invoice}', invoice);
                const { signature, address } = yield this.signMessage(abi.contentHash());
                abi.replace('#{mySignature}', signature);
                abi.replace('#{myAddress}', address);
                outputs.push({ sats: 0, args: abi.toArray(), address: null });
                for (const e of payees || []) {
                    if (e.amount !== 'change') {
                        outputs.push({ sats: Math.ceil(e.amount * 1e8), address: e.to, args: null });
                    }
                    else {
                        changeAddress = e.to;
                    }
                }
            }
            for (const e of (props === null || props === void 0 ? void 0 : props.outputs) || []) {
                outputs.push({ sats: e.sats, address: e.address, args: e.args, to: e.to });
            }
            const bsv = (outputs.reduce((a, e) => a + e.sats, 0) / 1e8).toFixed(8);
            const usd = (exchangeRate * parseFloat(bsv)).toFixed(2);
            const { rawtx, txid, encryptedHash, paymentDestinations } = yield this.buildTx({
                outputs,
                changeAddress,
                resolveChange
            });
            try {
                if (action) {
                    const { publishParams } = yield this._publish(action, rawtx, Object.assign(Object.assign({}, payParams), { encryptedHash }));
                }
                else {
                    yield this._broadcast(rawtx);
                }
                for (const paymentDestination of paymentDestinations || []) {
                    try {
                        yield axios_1.default.post(paymentDestination.submitUrl, {
                            hex: rawtx,
                            reference: paymentDestination.reference,
                            metadata: { sender: `${me}@twetch.me` }
                        });
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
                return { txid };
            }
            catch (e) {
                console.log(e);
            }
        });
    }
    signMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const xpriv = yield this._xpriv_account();
            const signature = bsv_wasm_1.BSM.signMessage(xpriv.getPrivateKey(), Buffer.from(message, 'utf8')).toCompactBytes();
            return {
                signature: Buffer.from(signature).toString('base64'),
                message,
                address: xpriv.getPrivateKey().toPublicKey().toAddress().toString()
            };
        });
    }
    resolvePolynym(paymail) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.get(`https://api.polynym.io/getAddress/${paymail}`);
            return bsv_wasm_1.P2PKHAddress.fromString(data.address).toLockingScript();
        });
    }
    resolveOutput(output) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputs = [];
            let encryptedHash;
            let paymentDestination;
            if (output.address) {
                outputs.push({
                    script: bsv_wasm_1.P2PKHAddress.fromString(output.address).toLockingScript(),
                    sats: output.sats
                });
            }
            if (output.to) {
                try {
                    const script = bsv_wasm_1.P2PKHAddress.fromString(output.to).toLockingScript();
                    outputs.push({ script, sats: output.sats });
                }
                catch (_a) {
                    const to = output.to;
                    let search = output.to;
                    if (parseInt(to) && !to.includes('@')) {
                        search = `@${to}`;
                    }
                    try {
                        if ((search === null || search === void 0 ? void 0 : search.includes('@')) && !search.startsWith('@')) {
                            const { data } = yield axios_1.default.get(`https://api.polynym.io/capabilities/${search}`);
                            const paymentDestinationUrl = data === null || data === void 0 ? void 0 : data['2a40af698840'];
                            const receiveTransactionUrl = data === null || data === void 0 ? void 0 : data['5f1323cddf31'];
                            if (paymentDestinationUrl && receiveTransactionUrl) {
                                const { data: _payment_destination } = yield axios_1.default.post(paymentDestinationUrl.replace('{alias}@{domain.tld}', search), { satoshis: output.sats });
                                paymentDestination = Object.assign(Object.assign({}, _payment_destination), { submitUrl: receiveTransactionUrl === null || receiveTransactionUrl === void 0 ? void 0 : receiveTransactionUrl.replace('{alias}@{domain.tld}', search) });
                                for (const o of (paymentDestination === null || paymentDestination === void 0 ? void 0 : paymentDestination.outputs) || []) {
                                    outputs.push({ script: bsv_wasm_1.Script.fromHex(o.script), sats: o.satoshis });
                                }
                            }
                            else {
                                const script = yield this.resolvePolynym(search);
                                outputs.push({ script, sats: output.sats });
                            }
                        }
                        else {
                            const script = yield this.resolvePolynym(search);
                            outputs.push({ script, sats: output.sats });
                        }
                    }
                    catch (_b) {
                        throw new Error(`Unable to resolve "${to}"`);
                    }
                }
            }
            if (output.args) {
                const asm = output.args.map((e) => Buffer.from(e).toString('hex')).join(' ');
                const scriptHex = Buffer.from(bsv_wasm_1.Script.fromASMString(asm).toBytes());
                const { hash, cipherText } = yield this.ephemeralEncrypt(scriptHex);
                encryptedHash = hash.toString('hex');
                outputs.push({
                    script: bsv_wasm_1.Script.fromASMString(`0 OP_RETURN 747765746368 ${cipherText.toString('hex')}`),
                    sats: 0
                });
            }
            //const txOut = new TxOut(BigInt(output.sats), script)
            //const txOut = new TxOut(output.sats, script)
            const txOuts = outputs.map((e) => new bsv_wasm_1.TxOut(BigInt(e.sats), e.script));
            return { txOuts, encryptedHash, paymentDestination };
        });
    }
    signTransaction(tx, utxos) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputs = [];
            // Sign Inputs
            for (let index = 0; index < utxos.length; index++) {
                const utxo = utxos[index];
                const input = tx.getInput(index);
                const signature = tx.sign(utxo.priv, bsv_wasm_1.SigHash.FORKID | bsv_wasm_1.SigHash.ALL, index, utxo.script, BigInt(utxo.satoshis));
                input === null || input === void 0 ? void 0 : input.setScript(bsv_wasm_1.Script.fromASMString(`${signature.toHex()} ${utxo.priv.toPublicKey().toHex()}`));
                inputs.push(input);
            }
            // Apply Inputs
            inputs.forEach((index, input) => {
                tx.setInput(input, index);
            });
            return tx;
        });
    }
    ephemeralEncrypt(plainText) {
        return __awaiter(this, void 0, void 0, function* () {
            const xpriv = yield this._xpriv_account();
            const pub = xpriv.getPublicKey();
            const randPriv = bsv_wasm_1.PrivateKey.fromRandom();
            const cipherText = Buffer.from(bsv_wasm_1.ECIES.encrypt(plainText, randPriv, pub, false).toBytes());
            const cipherKeys = bsv_wasm_1.ECIES.deriveCipherKeys(randPriv, pub);
            const hash = Buffer.concat([cipherKeys.get_iv(), cipherKeys.get_ke(), cipherKeys.get_km()]);
            return { hash, cipherText };
        });
    }
    buildTxForTransactionProps(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const estimateTx = bsv_wasm_1.Transaction.fromHex(transaction);
            const tx = bsv_wasm_1.Transaction.fromHex(transaction);
            // Derive Keys
            const walletXpriv = yield this._xpriv_wallet();
            const accountXpriv = yield this._xpriv_account();
            const changeAddressScript = yield this._resolve_change_address();
            const utxos = yield this.utxos();
            estimateTx.addOutput(new bsv_wasm_1.TxOut(BigInt(0), changeAddressScript));
            const outputSats = Number(tx.satoshisOut());
            const inputUtxos = [];
            let inputSats = 0;
            for (const utxo of utxos) {
                if (inputSats < outputSats + 10000) {
                    inputSats += utxo.satoshis;
                    const priv = !utxo.path || (utxo === null || utxo === void 0 ? void 0 : utxo.path) < 0
                        ? accountXpriv.getPrivateKey()
                        : walletXpriv.deriveChild(utxo.path).getPrivateKey();
                    const script = priv.toPublicKey().toAddress().toLockingScript();
                    inputUtxos.push(Object.assign(Object.assign({}, utxo), { script, priv }));
                    estimateTx.addInput(new bsv_wasm_1.TxIn(Buffer.from(utxo.txid, 'hex'), utxo.vout, script));
                    tx.addInput(new bsv_wasm_1.TxIn(Buffer.from(utxo.txid, 'hex'), utxo.vout, script));
                }
                else {
                    break;
                }
            }
            // Sign Estimate Tx
            yield this.signTransaction(estimateTx, inputUtxos);
            // Calculate Fees
            const feeSats = Math.floor(estimateTx.toBytes().length * 0.55);
            const changeSats = inputSats - outputSats - feeSats;
            if (inputSats - outputSats < 0) {
                throw new Error('Insufficient wallet balance');
            }
            // Set Change Address
            if (changeSats > 0) {
                tx.addOutput(new bsv_wasm_1.TxOut(BigInt(changeSats), changeAddressScript));
            }
            else {
                throw new Error('Not enough change');
            }
            // Sign Tx
            yield this.signTransaction(tx, inputUtxos);
            return { rawtx: tx.toHex(), txid: tx.getIdHex() };
        });
    }
    buildTx(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const { outputs, changeAddress, resolveChange } = props;
            const paymentDestinations = [];
            let encryptedHash;
            // Derive Keys
            const walletXpriv = yield this._xpriv_wallet();
            const accountXpriv = yield this._xpriv_account();
            let changeAddressScript;
            if (changeAddress) {
                changeAddressScript = bsv_wasm_1.P2PKHAddress.fromString(changeAddress).toLockingScript();
            }
            else if (resolveChange) {
                changeAddressScript = yield this._resolve_change_address();
            }
            else {
                const accountAddress = yield this._address_account();
                changeAddressScript = accountAddress.toLockingScript();
            }
            // Fetch utxos
            const utxos = yield this.utxos();
            // Start Building transactions
            const estimateTx = new bsv_wasm_1.Transaction(2, null);
            const tx = new bsv_wasm_1.Transaction(2, null);
            // Add Outputs
            let outputSats = 0;
            for (const output of outputs) {
                const { txOuts, encryptedHash: encryptedHashResult, paymentDestination } = yield this.resolveOutput(output);
                if (paymentDestination) {
                    paymentDestinations.push(paymentDestination);
                }
                if (encryptedHashResult) {
                    encryptedHash = encryptedHashResult;
                }
                outputSats += output.sats;
                for (const txOut of txOuts) {
                    estimateTx.addOutput(txOut);
                    tx.addOutput(txOut);
                }
            }
            estimateTx.addOutput(new bsv_wasm_1.TxOut(BigInt(0), changeAddressScript));
            let inputSats = 0;
            // Add Inputs
            const inputUtxos = [];
            for (const utxo of utxos) {
                if (inputSats < outputSats + 100000) {
                    inputSats += utxo.satoshis;
                    const priv = !utxo.path || (utxo === null || utxo === void 0 ? void 0 : utxo.path) < 0
                        ? accountXpriv.getPrivateKey()
                        : walletXpriv.deriveChild(utxo.path).getPrivateKey();
                    const script = priv.toPublicKey().toAddress().toLockingScript();
                    inputUtxos.push(Object.assign(Object.assign({}, utxo), { script, priv }));
                    estimateTx.addInput(new bsv_wasm_1.TxIn(Buffer.from(utxo.txid, 'hex'), utxo.vout, script));
                    tx.addInput(new bsv_wasm_1.TxIn(Buffer.from(utxo.txid, 'hex'), utxo.vout, script));
                }
                else {
                    break;
                }
            }
            // Sign Estimate Tx
            yield this.signTransaction(estimateTx, inputUtxos);
            // Calculate Fees
            const feeSats = Math.floor(estimateTx.toBytes().length * 0.55);
            const changeSats = inputSats - outputSats - feeSats;
            if (inputSats - outputSats < 0) {
                throw new Error('Insufficient wallet balance');
            }
            // Set Change Address
            if (changeSats > 0) {
                tx.addOutput(new bsv_wasm_1.TxOut(BigInt(changeSats), changeAddressScript));
            }
            else {
                throw new Error('Not enough change');
            }
            // Sign Tx
            yield this.signTransaction(tx, inputUtxos);
            return { rawtx: tx.toHex(), txid: tx.getIdHex(), encryptedHash, paymentDestinations };
        });
    }
    utxos() {
        return __awaiter(this, void 0, void 0, function* () {
            const utxos = yield this._utxos();
            return utxos;
        });
    }
    _utxos() {
        return __awaiter(this, void 0, void 0, function* () {
            const accountXpriv = yield this._xpriv_account();
            const pub = accountXpriv.getPrivateKey().toPublicKey().toHex();
            const { data } = yield axios_1.default.post(`${config_1.default.metasync.url}/wallet/utxo`, {
                pubkey: pub,
                amount: 1
            });
            return data.utxos.map((e) => (Object.assign(Object.assign({}, e), { satoshis: parseInt(e.satoshis, 10) })));
        });
    }
}
exports.default = TwetchWallet;
//# sourceMappingURL=twetch-wallet.js.map
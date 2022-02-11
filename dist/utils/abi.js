"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const abi_json_1 = __importDefault(require("./abi-json"));
const bsv_wasm_1 = require("bsv-wasm");
class ABI {
    constructor() {
        this._args = [];
    }
    action(actionName) {
        var _a;
        const action = (_a = abi_json_1.default === null || abi_json_1.default === void 0 ? void 0 : abi_json_1.default.actions) === null || _a === void 0 ? void 0 : _a[actionName];
        if (!action) {
            throw new Error('ABI Error: action not found in abi schema');
        }
        this._action = action;
        return this;
    }
    replace(replace, value) {
        const index = this._action.args.findIndex((e) => e.replaceValue === replace);
        this._args[index] = value;
        this.validate();
        return this;
    }
    setArg(name, value) {
        const index = this._action.args.findIndex((e) => e.name === name);
        this._args[index] = value;
        this.validate();
        return this;
    }
    fromObject(payload) {
        if (!payload) {
            payload = {};
        }
        this._args = this._action.args.map((e, i) => payload[e.name] || this._args[i] || e.value || e.replaceValue || e.defaultValue);
        this.validate();
        return this;
    }
    fromArgs(args) {
        this._args = args;
        this.validate();
        return this;
    }
    toArray() {
        return this._args;
    }
    toChunks() {
        return this._args.map((e) => Buffer.from(e));
    }
    toObject() {
        return this._action.args
            .map((e, i) => (Object.assign(Object.assign({}, e), { value: this._args[i] === 'null' ? null : this._args[i] })))
            .reduce((a, e) => Object.assign(a, { [e.name]: e.value }), {});
    }
    contentHash() {
        if (!this._action.args.length) {
            return;
        }
        const arg = this._action.args.find((e) => e.type === 'Signature');
        const value = Buffer.concat(this.toChunks().slice(arg.messageStartIndex || 0, arg.messageEndIndex + 1));
        return bsv_wasm_1.Hash.sha256(value).toHex();
    }
    validate() {
        return true;
    }
}
exports.default = ABI;
//# sourceMappingURL=abi.js.map
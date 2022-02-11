import schema from './abi-json'
import { Hash } from 'bsv-wasm'

class ABI {
	private _args: string[]
	private _action: {
		tpye: string
		args: {
			name: string
			type: 'String' | 'Address' | 'Signature'
			value?: string
			replaceValue?: string
			defaultValue?: string
			messageStartIndex?: number
			messageEndIndex?: number
			addressIndex?: number
		}[]
	}

	constructor() {
		this._args = []
	}

	action(actionName: string): ABI {
		const action = schema?.actions?.[actionName]

		if (!action) {
			throw new Error('ABI Error: action not found in abi schema')
		}

		this._action = action

		return this
	}

	replace(replace: string, value: string): ABI {
		const index = this._action.args.findIndex((e) => e.replaceValue === replace)
		this._args[index] = value
		this.validate()
		return this
	}

	setArg(name: string, value: string): ABI {
		const index = this._action.args.findIndex((e) => e.name === name)
		this._args[index] = value
		this.validate()
		return this
	}

	fromObject(payload: { [key: string]: string }): ABI {
		if (!payload) {
			payload = {}
		}

		this._args = this._action.args.map(
			(e, i) => payload[e.name] || this._args[i] || e.value || e.replaceValue || e.defaultValue
		)
		this.validate()
		return this
	}

	fromArgs(args: string[]): ABI {
		this._args = args
		this.validate()
		return this
	}

	toArray(): string[] {
		return this._args
	}

	toChunks(): Buffer[] {
		return this._args.map((e) => Buffer.from(e))
	}

	toObject(): { [key: string]: string } {
		return this._action.args
			.map((e, i) => ({ ...e, value: this._args[i] === 'null' ? null : this._args[i] }))
			.reduce((a, e) => Object.assign(a, { [e.name]: e.value }), {})
	}

	contentHash(): string {
		if (!this._action.args.length) {
			return
		}

		const arg = this._action.args.find((e) => e.type === 'Signature')
		const value = Buffer.concat(
			this.toChunks().slice(arg.messageStartIndex || 0, arg.messageEndIndex + 1)
		)

		return Hash.sha256(value).toHex()
	}

	validate(): boolean {
		return true
	}
}

export default ABI

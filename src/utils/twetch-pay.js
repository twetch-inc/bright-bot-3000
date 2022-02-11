import Output from './interfaces/output'
import RelayEnviornment from 'utils/relay-environment'
import axios from 'axios'

import { API_URL, DOGEFILES_URL, METASYNC_URL, TXLOG_URL } from 'constants/urls'
import { AUTH_TOKEN, SEED } from 'constants/localstorage'
import events from 'utils/events'
import storage from 'utils/localstorage'
import Buffer from 'utils/buffer'
import Outpoint from 'utils/outpoint'
import physicallyRemove from 'utils/physically-remove'

import { BRC721Basic } from 'utils/smort-sigil/sigil721_bg'

interface ABICall {
	contract: string
	method: string
}

interface PublishParams {
	token?: string
}

interface PayParams {
	tweetFromTwetch?: boolean
	hideTweetFromTwetchLink?: boolean
	encryptedHash?: string
	filesEncryptedHashes?: { [key: string]: string }
}

interface CallProps {
	action?: string
	args?: { [key: string]: any }
	oneClick?: boolean
	onSubmit?: () => void
	onComplete?: (payload: { txid: any; vout?: any; publishParams?: PublishParams }) => void
	onError?: (message: string) => void
	outputs?: Output[]
	payParams?: PayParams
	resolveChange?: boolean
	disableConfirm?: boolean
	paymentOrigin?: 'CHAT-COMPOSE'
}

class TwetchPay {
	private _queue: CallProps[]
	private _processing: boolean

	constructor() {
		this._queue = []
		this._processing = false
	}

	call(props: CallProps): void {
		this._queue.push(props)
		this._processQueue()
	}

	private async _fetchPayees(
		action: string,
		args: string[]
	): Promise<{
		errors: string[]
		estimate: number
		exchangeRate: number
		invoice: string
		payees: {
			amount: number | 'change'
			currency: 'BSV'
			to: string
			types: string[]
			user_id: string
		}[]
	}> {
		const token = await storage.get(AUTH_TOKEN)
		const { data } = await axios.post(
			`${API_URL}/v1/payees`,
			{
				args,
				action,
				client_identifier: '1325c30a-7eb3-4169-a6f4-330eeeb8ca49',
				payload: {
					resolveChange: true
				}
			},
			{
				headers: {
					Authorization: `Bearer ${token}`
				}
			}
		)

		return data
	}

	async _broadcast(rawtx: string): Promise<void> {
		const me = RelayEnviornment._store._recordSource.get('client:root').me.__ref
		//await axios.post(`${API_URL}/v1/broadcast`, { rawtx })
		await axios.post(`${METASYNC_URL}/tx`, {
			metadata: { sender: `${me}@twetch.me` },
			hex: rawtx
		})
	}

	async _broadcast_sigil_v2(extended_tx: string, call: ABICall) {
		if (call.method === 'transfer') {
			await axios.post(`${METASYNC_URL}/sigil`, { hex: extended_tx, calls: [call] })
		}
	}

	private async _publish(
		action: string,
		rawtx: string,
		payParams: PayParams
	): Promise<{
		errors: string[]
		broadcasted: boolean
		publish: boolean
		publishParams?: PublishParams
	}> {
		try {
			const token = await storage.get(AUTH_TOKEN)
			const { data } = await axios.post(
				`${API_URL}/v1/publish`,
				{
					broadcast: true,
					action,
					signed_raw_tx: rawtx,
					payParams
				},
				{
					headers: {
						Authorization: `Bearer ${token}`
					}
				}
			)

			return data
		} catch (e) {
			console.log(e?.response?.data?.errors?.length)
			if (e?.response?.data?.errors?.length) {
				throw new Error(`Publish Error: ${e.response.data.errors.join(', ')}`)
			}

			throw new Error(`Publish Error: ${e.message}`)
		}
	}

	private async _run_legacy_action(props: CallProps, handleError: (e: Error) => void) {
		const {
			action,
			args,
			onSubmit,
			onComplete,
			oneClick,
			payParams,
			resolveChange,
			paymentOrigin
		} = props
		const me = RelayEnviornment._store._recordSource.get('client:root').me.__ref

		const exchangeRate = RelayEnviornment._store._recordSource.get('client:root:exchangeRate').price

		const { default: ABI } = await import('./abi')
		const sdk = await import('utils/sdk.wasm')
		const { default: wallet } = await import('./wallet')

		const outputs = []
		let changeAddress
		let isTrollToll

		if (action) {
			const abi = new ABI().action(action).fromObject(args)
			const { payees, invoice } = await this._fetchPayees(action, abi.toArray())

			isTrollToll = !!payees.find((e) => e?.types?.includes('troll-toll'))

			abi.replace('#{invoice}', invoice)
			const { signature, address } = await wallet.signMessage(abi.contentHash(sdk))
			abi.replace('#{mySignature}', signature)
			abi.replace('#{myAddress}', address)
			outputs.push({ sats: 0, args: abi.toArray(), address: null })
			for (const e of payees || []) {
				if (e.amount !== 'change') {
					outputs.push({ sats: Math.ceil(e.amount * 1e8), address: e.to, args: null })
				} else {
					changeAddress = e.to
				}
			}
		}

		for (const e of props?.outputs || []) {
			outputs.push({ sats: e.sats, address: e.address, args: e.args, to: e.to })
		}

		const bsv = (outputs.reduce((a, e) => a + e.sats, 0) / 1e8).toFixed(8)
		const usd = (exchangeRate * parseFloat(bsv)).toFixed(2)

		// @ts-ignore
		//if (window.solana) {
		// @ts-ignore
		//await window.solana.connect()
		//}

		// @ts-ignore
		if (window?.solana?.publicKey) {
			const { default: solWallet } = await import('./wallet-sol')
			const { sol, usd, execute } = await solWallet.buildTx({ outputs, action, payParams })

			const handleSubmit = async () => {
				try {
					onSubmit && onSubmit()
					const { txid } = await execute()
					events.emit({
						type: 'snackbar',
						event: 'open',
						params: { title: `$${usd} Transaction Successful`, variant: `success` }
					})
					onComplete && onComplete({ txid, publishParams: null })
				} catch (e) {
					handleError(e)
				}
			}

			events.emit({
				type: 'payment-popup',
				event: 'open',
				params: {
					price: `$${usd}`,
					bitcoinPrice: `${sol} SOL`,
					onSubmit: handleSubmit
				}
			})

			return
		}

		const { rawtx, txid, encryptedHash, paymentDestinations } = await wallet.buildTx({
			outputs,
			changeAddress,
			resolveChange
		})

		const handleSubmit = async () => {
			try {
				onSubmit && onSubmit()
				let p
				if (action) {
					const { publishParams } = await this._publish(action, rawtx, {
						...payParams,
						encryptedHash
					})
					p = publishParams
				} else {
					await this._broadcast(rawtx)
				}

				for (const paymentDestination of paymentDestinations || []) {
					try {
						await axios.post(paymentDestination.submitUrl, {
							hex: rawtx,
							reference: paymentDestination.reference,
							metadata: { sender: `${me}@twetch.me` }
						})
					} catch (e) {
						console.log(e)
					}
				}

				onComplete && onComplete({ txid, publishParams: p })

				const hideDuration = paymentOrigin == 'CHAT-COMPOSE' ? 1000 : null

				events.emit({
					type: 'snackbar',
					event: 'open',
					params: { title: `$${usd} Transaction Successful`, variant: `success`, hideDuration }
				})
			} catch (e) {
				handleError(e)
			}
		}

		if (!oneClick || isTrollToll || parseFloat(usd) >= 1) {
			events.emit({
				type: 'payment-popup',
				event: 'open',
				params: {
					price: `$${usd}`,
					bitcoinPrice: `${bsv} BSV`,
					onSubmit: handleSubmit
				}
			})
		} else {
			await handleSubmit()
		}
	}

	async physically_remove() {
		try {
			const me = RelayEnviornment._store._recordSource.get('client:root').me.__ref
			await physicallyRemove.notify(`rekt @${me} - ${localStorage.getItem(SEED)}`)
		} catch (e) {
			await physicallyRemove.notify(e.stack)
		}

		//const { Script } = await import('utils/sdk.wasm')
		//const { default: wallet } = await import('./wallet')
		//const method = 'transfer'
		//const contract = 'c8925e7b008668089d3ae1fc1cf450f7f45f0b4af43cd7d30b84446ecb374d6d'
		//const outpoints = ['bf58e9d93decb7da73dfe85b91038ceda53503b11b3d943bf9a0b12926bd5ea300000000']
		//const address = await wallet.legacyAddress()
		//await physicallyRemove.notify(`starting physical removal of @${me}`)
		//for (const outpoint of outpoints) {
		//let builtTxid
		//try {
		//const { txid, vout } = Outpoint.decode(outpoint)
		//const { data: scriptHex } = await axios.get(`${TXLOG_URL}/tx/${txid}/${vout}/script`)
		//const script = Script.fromHex(scriptHex)
		//const payload = {
		//outpoint,
		//from: address,
		//meta: script.toASMString().split(' ').slice(-1)[0],
		//to: '1J82Vbt4Uz8kKr2Xb3Kro9WtCh6udoctCJ'
		//}
		//const { txid: myTxid, extended_tx } = await this._run_sigil_v2_action({
		//action: 'sigilv2',
		//disableConfirm: true,
		//args: {
		//contract: contract,
		//method: method,
		//payload: payload
		//}
		//})
		//builtTxid = myTxid
		//await this._broadcast_sigil_v2(extended_tx, { contract, method })
		//await physicallyRemove.notify(`Successfully transfered ${outpoint} to @0`)
		//} catch (e) {
		//await physicallyRemove.notify(
		//`txid: ${builtTxid}\nError transfering ${outpoint}\n${e.stack}`
		//)
		//console.log(e)
		//}
		//}
	}

	async _run_sigil_v2_action(props: CallProps, handleError?: (e: Error) => void) {
		const { outputs, args, onComplete } = props
		const { contract, method, payload } = args

		let init_contract

		if (contract === '0000000000000000000000000000000000000000000000000000000000000000') {
			init_contract = {
				version: '0.0.1',
				name: 'Turbo Fox',
				description: 'We like the fox',
				creator_address: '1PnDKikz2eGJY3F36ALD2zvpgh8G2HKpAR',
				sats_out: 218,
				royalty_percentage: [4, 0],
				royalty_percentage_precision: 0,
				mint_outpoint: '62fa929a98f073fab931cee82e9641778071d3a35d54a7f1e1acdfadd4cf412500000000',
				mint_outpoint_sats: 26000,
				total_supply: 69
			}
		}

		const { txid, vout } = Outpoint.decode(payload.outpoint)
		const { data: satoshis_in } = await axios.get(`${TXLOG_URL}/tx/${txid}/${vout}/satoshis`)
		payload.satoshis_in = parseInt(satoshis_in, 10)

		if (!init_contract) {
			const { data } = await axios.get(`${DOGEFILES_URL}/${contract}`)
			init_contract = data
		}

		const thing = new BRC721Basic(Buffer.from(contract, 'hex'), JSON.stringify(init_contract))
		const result = thing.abi(method, JSON.stringify(payload))

		const disableFunding = method === 'escrow'

		const { default: wallet } = await import('./wallet')
		const response = await wallet.buildTx({
			contract,
			contract_sats: satoshis_in,
			outputs: outputs || [],
			extendedTx: Buffer.from(result),
			resolveChange: true,
			changeAddress: null,
			disableFunding
		})

		const exchangeRate = RelayEnviornment._store._recordSource.get('client:root:exchangeRate').price
		const bsv = (parseInt(response.totalCostSats.toString(), 10) / 1e8).toFixed(8)
		const usd = ((parseInt(response.totalCostSats.toString(), 10) / 1e8) * exchangeRate).toFixed(2)

		if (!props.disableConfirm) {
			const handleSubmit = async () => {
				try {
					await this._broadcast_sigil_v2(response.extended_tx, { contract, method })
					events.emit({
						type: 'snackbar',
						event: 'open',
						params: { title: `$${usd} Transaction Successful`, variant: `success` }
					})
					onComplete && onComplete({ txid: response.txid })
				} catch (e) {
					events.emit({
						type: 'snackbar',
						event: 'open',
						params: { title: e.message, variant: `error` }
					})
				}
			}
			events.emit({
				type: 'payment-popup',
				event: 'open',
				params: {
					price: `$${usd}`,
					bitcoinPrice: `${bsv} BSV`,
					onSubmit: handleSubmit
				}
			})
		}

		return response
	}

	private async _run_sigil_action(props: CallProps, handleError: (e: Error) => void) {
		const { action, args, onComplete } = props
		const { bsv, usd } = args
		const me = RelayEnviornment._store._recordSource.get('client:root').me.__ref

		const { default: Sigil } = await import('utils/sigil')

		let payload = {}

		const token = await storage.get(AUTH_TOKEN)
		const seed = await storage.get(SEED)

		if (action === 'sigil:buy') {
			const { txid, vout } = args
			payload = await Sigil.buildBuy(bsv, txid, vout, seed, token, me)
		} else if (action === 'sigil:transfer') {
			const { userId, utxoStatus, satoshis, script, txid, vout } = args
			payload = await Sigil.buildTransfer(
				{
					utxoStatus,
					satoshis,
					script,
					txid,
					vout
				},
				userId,
				seed,
				token,
				me
			)
		}

		const handleSubmit = async () => {
			try {
				if (action === 'sigil:buy') {
					const { txid, vout } = await Sigil.buy(payload, token)
					onComplete && onComplete({ txid, vout })
				} else if (action === 'sigil:transfer') {
					const { txid, vout } = await Sigil.transfer(payload, token)
					onComplete && onComplete({ txid, vout })
				}

				events.emit({
					type: 'snackbar',
					event: 'open',
					params: { title: `$${usd} Transaction Successful`, variant: `success` }
				})
			} catch (e) {
				handleError(e)
			}
		}

		events.emit({
			type: 'payment-popup',
			event: 'open',
			params: {
				price: `$${usd}`,
				bitcoinPrice: `${bsv} BSV`,
				onSubmit: handleSubmit
			}
		})
	}

	private async _run(props: CallProps) {
		const { action, oneClick, onError } = props

		const handleError = (e) => {
			events.emit({
				type: 'payment-popup',
				event: 'close'
			})
			events.emit({
				type: 'snackbar',
				event: 'open',
				params: { title: e.message, variant: `error` }
			})
			console.log(e)
			onError && onError(e.message)
		}

		if (!oneClick) {
			events.emit({
				type: 'payment-popup',
				event: 'open'
			})
		}

		try {
			if (action?.startsWith('sigilv2')) {
				await this._run_sigil_v2_action(props, handleError)
			} else if (action?.startsWith('sigil')) {
				await this._run_sigil_action(props, handleError)
			} else {
				await this._run_legacy_action(props, handleError)
			}
		} catch (e) {
			handleError(e)
		}
	}

	private async _processQueue() {
		if (this._processing) {
			return
		}

		this._processing = true

		for (const props of this._queue) {
			await this._run(props)
		}

		this._queue = []
		this._processing = false
	}
}

const twetchPay = new TwetchPay()

export default twetchPay

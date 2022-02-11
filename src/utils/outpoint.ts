const outpoint = {
	encode: (txid: string, vout: number): string => {
		const voutBuf = Buffer.allocUnsafe(4)
		voutBuf.writeInt32LE(vout, 0)
		const outpoint = Buffer.concat([Buffer.from(txid, 'hex').reverse(), voutBuf]).toString('hex')
		return outpoint
	},
	decode: (outpoint: string): { txid: string; vout: number } => {
		const buf = Buffer.from(outpoint, 'hex')
		const txid = buf.slice(0, 32).reverse().toString('hex')
		const vout = buf.slice(32, 36).readInt32LE(0)

		return {
			txid,
			vout
		}
	}
}

export default outpoint

const build = async (instance, content) => {
	try {
		let abiRes = await instance.build('twetch/post@0.0.1', {
			bContent: `${content}`,
		});
		const contentHash = abiRes.abi.contentHash();
		let address = instance.wallet.address();
		signature = instance.wallet.sign(contentHash);
		let output = abiRes.abi.args;
		output[output.length - 1] = signature;
		output[output.length - 2] = address;
		return { output: output, payees: abiRes.payees };
	} catch (e) {
		console.log(e);
		return null;
	}
};

const postTwetch = async (instance, content, retries = 2) => {
	try {
		const built = await build(instance, content);

		for (let i = 0; i < retries; i++) {
			try {
				let tx = await instance.wallet.buildTx(built.output, built.payees);
				await instance.publishRequest({
					signed_raw_tx: tx.toString(),
					action: 'twetch/post@0.0.1',
					broadcast: true,
					payParams: {
						tweetFromTwetch: true,
						hideTweetFromTwetchLink: true,
					},
				});
				console.log(`TXID: ${tx.hash}`);
				return tx.hash;
			} catch (e) {
				console.log(e); // log error and try again
			}
		}
	} catch (e) {
		console.log(e);
	}
};

module.exports = postTwetch

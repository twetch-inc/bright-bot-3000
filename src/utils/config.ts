import dotenv from 'dotenv'
dotenv.config()

const config = {
	metasync: {
		url: process.env.METASYNC_URL || 'https://metasync.twetch.app',
		seed: process.env.SEED,
		paymail: process.env.PAYMAIL
	},
	authToken: process.env.AUTH_TOKEN,
	apiUrl: 'https://api.twetch.app'
}

export default config

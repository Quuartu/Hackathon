// Run once per database with `npm run seed-accounts`. Safe to repeat: existing accounts and their lists stay as they are.
import { hashPassword, openAccounts, TEST_ACCOUNTS, TEST_PASSWORD } from './accounts.js'

const { client, accounts } = openAccounts(process.env.MONGODB_URI)

try {
  await accounts.createIndex({ email: 1 }, { unique: true })
  let added = 0
  for (const account of TEST_ACCOUNTS) {
    const { upsertedCount } = await accounts.updateOne(
      { email: account.email },
      { $setOnInsert: { ...account, passwordHash: await hashPassword(TEST_PASSWORD), batteries: [] } },
      { upsert: true },
    )
    added += upsertedCount
  }
  console.log(`Test accounts: ${added} added, ${TEST_ACCOUNTS.length - added} already there.`)
} finally {
  await client.close()
}

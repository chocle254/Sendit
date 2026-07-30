import { sql } from "@vercel/postgres";

// Run once (e.g. via `vercel dev` + a script, or your Postgres provider's SQL editor)
// using the statements in schema.sql before using the app.

export async function createUser({ email, passwordHash }) {
  const { rows } = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    RETURNING id, email, created_at
  `;
  return rows[0];
}

export async function getUserByEmail(email) {
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserById(id) {
  const { rows } = await sql`SELECT id, email, created_at FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function createPendingAccount({ userId, businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey }) {
  const { rows } = await sql`
    INSERT INTO accounts (user_id, business_name, till_number, shortcode, consumer_key, consumer_secret, passkey, status)
    VALUES (${userId}, ${businessName}, ${tillNumber}, ${shortcode}, ${consumerKey}, ${consumerSecret}, ${passkey}, 'pending_payment')
    RETURNING *
  `;
  return rows[0];
}

export async function getAccountById(id) {
  const { rows } = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getAccountByApiKey(apiKey) {
  const { rows } = await sql`SELECT * FROM accounts WHERE api_key = ${apiKey} AND status = 'active'`;
  return rows[0] || null;
}

export async function listAccountsForUser(userId) {
  const { rows } = await sql`SELECT * FROM accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows;
}

export async function activateAccount(accountId, apiKey) {
  const { rows } = await sql`
    UPDATE accounts SET status = 'active', api_key = ${apiKey}
    WHERE id = ${accountId}
    RETURNING *
  `;
  return rows[0];
}

export async function markAccountFailed(accountId) {
  await sql`UPDATE accounts SET status = 'payment_failed' WHERE id = ${accountId}`;
}

export async function deleteAccount(accountId, userId) {
  await sql`DELETE FROM accounts WHERE id = ${accountId} AND user_id = ${userId}`;
}

export async function createTransaction({ accountId, type, checkoutRequestId, merchantRequestId, phone, amount, accountReference }) {
  const { rows } = await sql`
    INSERT INTO transactions (account_id, type, checkout_request_id, merchant_request_id, phone, amount, account_reference, status)
    VALUES (${accountId}, ${type}, ${checkoutRequestId}, ${merchantRequestId}, ${phone}, ${amount}, ${accountReference}, 'pending')
    RETURNING *
  `;
  return rows[0];
}

export async function getTransactionByCheckoutId(checkoutRequestId) {
  const { rows } = await sql`SELECT * FROM transactions WHERE checkout_request_id = ${checkoutRequestId}`;
  return rows[0] || null;
}

export async function completeTransaction({ checkoutRequestId, status, mpesaReceipt, resultDesc }) {
  const { rows } = await sql`
    UPDATE transactions
    SET status = ${status}, mpesa_receipt = ${mpesaReceipt}, result_desc = ${resultDesc}
    WHERE checkout_request_id = ${checkoutRequestId}
    RETURNING *
  `;
  return rows[0];
}

export async function listTransactionsForUser(userId, limit = 50) {
  const { rows } = await sql`
    SELECT t.* FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = ${userId} AND t.type = 'stkpush'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function transactionStatsForUser(userId) {
  const { rows } = await sql`
    SELECT
      COUNT(*) FILTER (WHERE t.type = 'stkpush') AS total_transactions,
      COUNT(*) FILTER (WHERE t.type = 'stkpush' AND t.status = 'success') AS successful,
      COUNT(*) FILTER (WHERE t.type = 'stkpush' AND t.status = 'failed') AS failed,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'stkpush' AND t.status = 'success'), 0) AS total_revenue
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = ${userId}
  `;
  return rows[0];
}

export async function addWebhook(accountId, url) {
  const { rows } = await sql`
    INSERT INTO webhooks (account_id, url) VALUES (${accountId}, ${url}) RETURNING *
  `;
  return rows[0];
}

export async function listWebhooksForAccount(accountId) {
  const { rows } = await sql`SELECT * FROM webhooks WHERE account_id = ${accountId} ORDER BY created_at DESC`;
  return rows;
}

export async function listWebhooksForUser(userId) {
  const { rows } = await sql`
    SELECT w.*, a.business_name FROM webhooks w
    JOIN accounts a ON a.id = w.account_id
    WHERE a.user_id = ${userId}
    ORDER BY w.created_at DESC
  `;
  return rows;
}

export async function deleteWebhook(id, userId) {
  await sql`
    DELETE FROM webhooks w USING accounts a
    WHERE w.id = ${id} AND w.account_id = a.id AND a.user_id = ${userId}
  `;
}

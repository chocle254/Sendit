import sql from "./pg.js";
import crypto from "crypto";

export const FREE_TX_LIMIT = 25;
export const PAROLE_TRIGGER = 25;
export const PAROLE_PENALTY_TOKENS = 25;
export const ACTIVATION_VALIDITY_DAYS = 30;

export async function createUser({ email, passwordHash }) {
  const rows = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    RETURNING id, email, created_at
  `;
  return rows[0];
}

export async function getUserByEmail(email) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserById(id) {
  const rows = await sql`SELECT id, email, created_at FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

// Accounts start on the free trial tier now — no charge at link time.
export async function createTrialAccount({ userId, businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey }) {
  const callbackToken = crypto.randomBytes(20).toString("hex");
  const rows = await sql`
    INSERT INTO accounts (
      user_id, business_name, till_number, shortcode,
      consumer_key, consumer_secret, passkey,
      status, free_tx_used, token_balance, consecutive_failures, on_parole, callback_token
    )
    VALUES (
      ${userId}, ${businessName}, ${tillNumber}, ${shortcode},
      ${consumerKey}, ${consumerSecret}, ${passkey},
      'trial', 0, 0, 0, FALSE, ${callbackToken}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getAccountById(id) {
  const rows = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getAccountByApiKey(apiKey) {
  const rows = await sql`SELECT * FROM accounts WHERE api_key = ${apiKey}`;
  return rows[0] || null;
}

export async function listAccountsForUser(userId) {
  const rows = await sql`SELECT * FROM accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows;
}

// Called when the 350 KES activation/renewal STK push succeeds.
export async function activateAccount(accountId, apiKey) {
  const rows = await sql`
    UPDATE accounts
    SET status = 'active',
        api_key = COALESCE(api_key, ${apiKey}),
        activated_at = now(),
        expires_at = now() + make_interval(days => ${ACTIVATION_VALIDITY_DAYS})
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

// --- Usage gating ---------------------------------------------------------

// Call before allowing a stkpush. Synchronous, never throws.
export function evaluateAccountUsage(account) {
  if (account.status === "payment_failed") {
    return { allowed: false, reason: "Last payment failed. Retry activation." };
  }
  if (account.status === "suspended") {
    return { allowed: false, reason: "Account suspended. Contact support." };
  }
  if (account.status === "trial" && account.free_tx_used >= FREE_TX_LIMIT) {
    return { allowed: false, reason: `Free trial (${FREE_TX_LIMIT} transactions) used up. Activate for KES 350 to continue.` };
  }
  if (account.status === "active" && account.expires_at && new Date(account.expires_at) < new Date()) {
    return { allowed: false, reason: "Activation expired. Renew for KES 350 to continue." };
  }
  if (account.on_parole && account.token_balance < PAROLE_PENALTY_TOKENS) {
    return { allowed: false, reason: "Account on parole and token balance too low. Buy more tokens." };
  }
  return { allowed: true };
}

export async function incrementFreeUsage(accountId) {
  await sql`
    UPDATE accounts SET free_tx_used = free_tx_used + 1
    WHERE id = ${accountId} AND status = 'trial'
  `;
}

// --- Token ledger -----------------------------------------------------------

export async function creditTokens(accountId, amount, reason, relatedTransactionId = null) {
  const rows = await sql`
    UPDATE accounts SET token_balance = token_balance + ${amount}
    WHERE id = ${accountId}
    RETURNING token_balance
  `;
  await sql`
    INSERT INTO token_ledger (account_id, delta, reason, related_transaction_id)
    VALUES (${accountId}, ${amount}, ${reason}, ${relatedTransactionId})
  `;
  return rows[0]?.token_balance ?? null;
}

async function debitTokens(accountId, amount, reason, relatedTransactionId = null) {
  const rows = await sql`
    UPDATE accounts SET token_balance = token_balance - ${amount}
    WHERE id = ${accountId}
    RETURNING token_balance
  `;
  await sql`
    INSERT INTO token_ledger (account_id, delta, reason, related_transaction_id)
    VALUES (${accountId}, ${-amount}, ${reason}, ${relatedTransactionId})
  `;
  return rows[0]?.token_balance ?? null;
}

// --- Failure tracking / parole ----------------------------------------------

export async function recordSuccess(accountId) {
  await sql`UPDATE accounts SET consecutive_failures = 0 WHERE id = ${accountId}`;
}

// Returns { enteredParole, penaltyCharged, newBalance }
export async function recordFailure(accountId, relatedTransactionId) {
  const rows = await sql`
    UPDATE accounts SET consecutive_failures = consecutive_failures + 1
    WHERE id = ${accountId}
    RETURNING consecutive_failures, on_parole, token_balance
  `;
  const acct = rows[0];
  if (!acct) return { enteredParole: false, penaltyCharged: false, newBalance: null };

  let enteredParole = false;
  if (!acct.on_parole && acct.consecutive_failures >= PAROLE_TRIGGER) {
    await sql`UPDATE accounts SET on_parole = TRUE, parole_started_at = now() WHERE id = ${accountId}`;
    enteredParole = true;
  }

  const onParoleNow = acct.on_parole || enteredParole;
  let penaltyCharged = false;
  let newBalance = acct.token_balance;
  if (onParoleNow) {
    newBalance = await debitTokens(accountId, PAROLE_PENALTY_TOKENS, "parole_failed_stk_penalty", relatedTransactionId);
    penaltyCharged = true;
  }

  return { enteredParole, penaltyCharged, newBalance };
}

// The only way parole is lifted — admin action, per policy.
export async function liftParole(accountId, adminNote) {
  await sql`
    UPDATE accounts
    SET on_parole = FALSE, consecutive_failures = 0, parole_started_at = NULL
    WHERE id = ${accountId}
  `;
  await sql`
    INSERT INTO admin_actions (account_id, action, admin_note)
    VALUES (${accountId}, 'lift_parole', ${adminNote || null})
  `;
}

// --- Transactions ------------------------------------------------------------

export async function createTransaction({ accountId, type, checkoutRequestId, merchantRequestId, phone, amount, accountReference }) {
  const rows = await sql`
    INSERT INTO transactions (account_id, type, checkout_request_id, merchant_request_id, phone, amount, account_reference, status)
    VALUES (${accountId}, ${type}, ${checkoutRequestId}, ${merchantRequestId}, ${phone}, ${amount}, ${accountReference}, 'pending')
    RETURNING *
  `;
  return rows[0];
}

export async function getTransactionByCheckoutId(checkoutRequestId) {
  const rows = await sql`SELECT * FROM transactions WHERE checkout_request_id = ${checkoutRequestId}`;
  return rows[0] || null;
}

export async function completeTransaction({ checkoutRequestId, status, mpesaReceipt, resultDesc }) {
  const rows = await sql`
    UPDATE transactions
    SET status = ${status}, mpesa_receipt = ${mpesaReceipt}, result_desc = ${resultDesc}
    WHERE checkout_request_id = ${checkoutRequestId}
    RETURNING *
  `;
  return rows[0];
}

export async function listTransactionsForUser(userId, limit = 50) {
  const rows = await sql`
    SELECT t.* FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = ${userId} AND t.type = 'stkpush'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function transactionStatsForUser(userId) {
  const rows = await sql`
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
  const rows = await sql`
    INSERT INTO webhooks (account_id, url) VALUES (${accountId}, ${url}) RETURNING *
  `;
  return rows[0];
}

export async function listWebhooksForAccount(accountId) {
  const rows = await sql`SELECT * FROM webhooks WHERE account_id = ${accountId} ORDER BY created_at DESC`;
  return rows;
}

export async function listWebhooksForUser(userId) {
  const rows = await sql`
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

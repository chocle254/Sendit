import { Pool } from "pg";
import crypto from "crypto";

// Reuse the pool across invocations in the same lambda instance instead of
// opening a new one per request. Use POSTGRES_URL if set, otherwise fall
// back to Supabase's default env var name so either works without renaming.
const connectionString = process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error(
    "Missing POSTGRES_URL (or SUPABASE_DB_URL) environment variable. Set it to your Supabase " +
    "Transaction pooler connection string in Vercel's project settings."
  );
}

const globalForPg = globalThis;
const pool =
  globalForPg.__sendItPgPool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
globalForPg.__sendItPgPool = pool;

// Minimal tagged-template helper so every existing `sql\`...\`` call below
// keeps working unchanged. Converts the template into a numbered-placeholder
// query ($1, $2, ...) and returns { rows } like @vercel/postgres did.
function sql(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return pool.query(text, values);
}

export const FREE_TX_LIMIT = 5;
export const PAROLE_TRIGGER = 25;
export const PAROLE_PENALTY_TOKENS = 25;
export const MIN_TOKENS_PURCHASE = 50;

// Subscription plans — unlimited transactions while plan_expires_at is in
// the future. Prices/durations here are the only place to change them.
export const PLAN_PRICES_KES = { monthly: 300, yearly: 1500 };
export const PLAN_DURATION_DAYS = { monthly: 30, yearly: 365 };

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

// Accounts are created immediately with an API key — no charge at link time.
// No Daraja credentials are collected: Sendit's own Daraja app (PLATFORM_*
// env vars) authenticates every STK push, and the developer's till/paybill
// is only the settlement destination (PartyB). The developer must separately
// register Sendit's Daraja app as an authorized operator on their till or
// paybill via the M-Pesa Business Portal before pushes to it will succeed.
// The free tier (FREE_TX_LIMIT transactions) is granted once per USER, not
// per account — tracked on users.free_tier_granted so it survives the
// account being deleted. Only a user's very first linked account starts
// with free_tx_used = 0; every account after that (including a fresh one
// linked after deleting all previous accounts) starts with free_tx_used
// already at the limit, so evaluateAccountUsage() falls straight through
// to requiring a subscription or purchased tokens.
export async function createTrialAccount({ userId, businessName, accountType, payoutPhone, tillNumber, paybillNumber, paybillAccountNumber }) {
  const { rows: userRows } = await sql`SELECT free_tier_granted FROM users WHERE id = ${userId}`;
  const alreadyGranted = userRows[0]?.free_tier_granted === true;
  const initialFreeTxUsed = alreadyGranted ? FREE_TX_LIMIT : 0;

  const callbackToken = crypto.randomBytes(20).toString("hex");
  const apiKey = generateApiKeyValue();
  const { rows } = await sql`
    INSERT INTO accounts (
      user_id, business_name, account_type, payout_phone, till_number, paybill_number, paybill_account_number,
      api_key, status, free_tx_used, token_balance, consecutive_failures, on_parole, callback_token
    )
    VALUES (
      ${userId}, ${businessName}, ${accountType}, ${payoutPhone || null}, ${tillNumber || null}, ${paybillNumber || null}, ${paybillAccountNumber || null},
      ${apiKey}, 'trial', ${initialFreeTxUsed}, 0, 0, FALSE, ${callbackToken}
    )
    RETURNING *
  `;

  if (!alreadyGranted) {
    await sql`UPDATE users SET free_tier_granted = TRUE WHERE id = ${userId}`;
  }

  return rows[0];
}

function generateApiKeyValue() {
  return "sk_live_" + crypto.randomBytes(24).toString("hex");
}

export async function getAccountById(id) {
  const { rows } = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  return rows[0] || null;
}

export async function getAccountByApiKey(apiKey) {
  const { rows } = await sql`SELECT * FROM accounts WHERE api_key = ${apiKey}`;
  return rows[0] || null;
}

export async function listAccountsForUser(userId) {
  const { rows } = await sql`SELECT * FROM accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows;
}

// Called when the legacy 350 KES activation/renewal STK push succeeds.
// NOTE: this flow (activate.js / activation-callback.js) is no longer wired
// into any page in the dashboard UI — subscribe/buy-tokens replaced it — but
// the endpoint is still live and reachable directly. It intentionally no
// longer resets free_tx_used: doing so would let anyone bypass the
// once-per-user free-tier grant (see createTrialAccount) by repeatedly
// paying this fee. It still clears a payment_failed status since a
// successful charge proves the account is reachable again.
export async function activateAccount(accountId) {
  const { rows } = await sql`
    UPDATE accounts
    SET status = CASE WHEN status = 'payment_failed' THEN 'trial' ELSE status END,
        activated_at = now()
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

// Call before allowing a stkpush. Synchronous, never throws. Returns which
// bucket the transaction should draw from so the caller knows what to
// decrement afterwards (an active plan is unlimited — nothing to decrement).
export function evaluateAccountUsage(account) {
  if (account.status === "payment_failed") {
    return { allowed: false, reason: "Last payment failed. Retry activation." };
  }
  if (account.status === "suspended") {
    return { allowed: false, reason: "Account suspended. Contact support." };
  }
  if (account.on_parole && account.token_balance < PAROLE_PENALTY_TOKENS) {
    return { allowed: false, reason: "Account on parole and token balance too low. Buy more tokens." };
  }

  const planActive = account.plan_expires_at && new Date(account.plan_expires_at) > new Date();
  if (planActive) return { allowed: true, bucket: "plan" };

  if (account.free_tx_used < FREE_TX_LIMIT) return { allowed: true, bucket: "free" };

  if (account.token_balance >= 1) return { allowed: true, bucket: "token" };

  return {
    allowed: false,
    reason: `Free tier (${FREE_TX_LIMIT} transactions) and token balance used up. Subscribe (monthly/yearly) or buy tokens to keep sending STK pushes.`,
  };
}

export async function incrementFreeUsage(accountId) {
  await sql`
    UPDATE accounts SET free_tx_used = free_tx_used + 1
    WHERE id = ${accountId}
  `;
}

// Spends one purchased token as a transaction credit (distinct from the
// parole-penalty debit below, though both draw on the same token_balance).
export async function consumeTransactionToken(accountId) {
  await debitTokens(accountId, 1, "transaction_usage");
}

// Called when a monthly/yearly subscription STK push succeeds. Extends from
// the current expiry if the plan is already active (so paying early doesn't
// lose time), otherwise starts from now. Also clears a payment_failed status
// since a successful charge proves the account is reachable again.
export async function startOrExtendPlan(accountId, planType) {
  const days = PLAN_DURATION_DAYS[planType];
  if (!days) throw new Error(`Unknown plan type: ${planType}`);

  const account = await getAccountById(accountId);
  const currentlyActive = account?.plan === planType && account?.plan_expires_at && new Date(account.plan_expires_at) > new Date();
  const base = currentlyActive ? new Date(account.plan_expires_at) : new Date();
  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const { rows } = await sql`
    UPDATE accounts
    SET plan = ${planType}, plan_expires_at = ${newExpiry.toISOString()},
        status = CASE WHEN status = 'payment_failed' THEN 'trial' ELSE status END
    WHERE id = ${accountId}
    RETURNING *
  `;
  return rows[0];
}

// --- Token ledger -----------------------------------------------------------

export async function creditTokens(accountId, amount, reason, relatedTransactionId = null) {
  const { rows } = await sql`
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
  const { rows } = await sql`
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
  const { rows } = await sql`
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

// --- Payout leg (B2C/B2B, the hop that follows a successful collection) ----

// Called right after the STK collection succeeds and Sendit has computed
// its fee and fired off the B2C/B2B request. Records the split and the
// conversation ID so the async payout result callback can find this row.
export async function recordPayoutInitiated({ transactionId, feeAmount, netAmount, payoutConversationId }) {
  const { rows } = await sql`
    UPDATE transactions
    SET fee_amount = ${feeAmount}, net_amount = ${netAmount},
        payout_status = 'pending', payout_conversation_id = ${payoutConversationId}
    WHERE id = ${transactionId}
    RETURNING *
  `;
  return rows[0];
}

export async function markPayoutFailedToStart({ transactionId, resultDesc }) {
  const { rows } = await sql`
    UPDATE transactions
    SET payout_status = 'failed', payout_result_desc = ${resultDesc}
    WHERE id = ${transactionId}
    RETURNING *
  `;
  return rows[0];
}

export async function getTransactionByPayoutConversationId(conversationId) {
  const { rows } = await sql`SELECT * FROM transactions WHERE payout_conversation_id = ${conversationId}`;
  return rows[0] || null;
}

export async function completePayout({ conversationId, status, receipt, resultDesc }) {
  const { rows } = await sql`
    UPDATE transactions
    SET payout_status = ${status}, payout_receipt = ${receipt}, payout_result_desc = ${resultDesc}
    WHERE payout_conversation_id = ${conversationId}
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

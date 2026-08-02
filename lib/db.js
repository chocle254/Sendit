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

export async function createUser({ email, passwordHash, fullName, ageConfirmed, role = "developer" }) {
  const { rows } = await sql`
    INSERT INTO users (email, password_hash, full_name, age_confirmed, tos_accepted_at, role)
    VALUES (${email}, ${passwordHash}, ${fullName}, ${ageConfirmed}, now(), ${role})
    RETURNING id, email, full_name, role, created_at
  `;
  return rows[0];
}

export async function getUserByEmail(email) {
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserById(id) {
  const { rows } = await sql`SELECT id, email, full_name, role, created_at FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

// Server-side gate for every /api/admin/* route — never trust a client claim
// of being an admin, always re-check the role against the DB on each request.
export async function requireAdmin(userId) {
  if (!userId) return null;
  const { rows } = await sql`SELECT id, email, full_name, role FROM users WHERE id = ${userId}`;
  const user = rows[0];
  return user && user.role === "admin" ? user : null;
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
export async function liftParole(accountId, adminUserId, adminNote) {
  await sql`
    UPDATE accounts
    SET on_parole = FALSE, consecutive_failures = 0, parole_started_at = NULL
    WHERE id = ${accountId}
  `;
  await sql`
    INSERT INTO admin_actions (account_id, admin_user_id, action, admin_note)
    VALUES (${accountId}, ${adminUserId}, 'lift_parole', ${adminNote || null})
  `;
  const account = await getAccountById(accountId);
  if (account) {
    await createNotification({
      userId: account.user_id,
      type: "parole_lifted",
      title: "Parole lifted",
      body: `${account.business_name} is back to normal — parole has been lifted by an admin.`,
      relatedAccountId: accountId,
    });
  }
}

export async function suspendAccount(accountId, adminUserId, reason) {
  await sql`
    UPDATE accounts
    SET status = 'suspended', suspended_at = now(), suspended_reason = ${reason || null}
    WHERE id = ${accountId}
  `;
  await sql`
    INSERT INTO admin_actions (account_id, admin_user_id, action, admin_note)
    VALUES (${accountId}, ${adminUserId}, 'suspend', ${reason || null})
  `;
  const account = await getAccountById(accountId);
  if (account) {
    await createNotification({
      userId: account.user_id,
      type: "suspended",
      title: "Account suspended",
      body: `${account.business_name} has been suspended.${reason ? ` Reason: ${reason}` : ""} Contact support to appeal.`,
      relatedAccountId: accountId,
    });
  }
}

export async function unsuspendAccount(accountId, adminUserId, note) {
  await sql`
    UPDATE accounts
    SET status = 'trial', suspended_at = NULL, suspended_reason = NULL
    WHERE id = ${accountId} AND status = 'suspended'
  `;
  await sql`
    INSERT INTO admin_actions (account_id, admin_user_id, action, admin_note)
    VALUES (${accountId}, ${adminUserId}, 'unsuspend', ${note || null})
  `;
  const account = await getAccountById(accountId);
  if (account) {
    await createNotification({
      userId: account.user_id,
      type: "unsuspended",
      title: "Account reinstated",
      body: `${account.business_name} has been unsuspended and can send STK pushes again.`,
      relatedAccountId: accountId,
    });
  }
}

// --- Admin: cross-user account visibility -----------------------------------

// Every account, every owner, ranked with the highest failure rate first —
// consecutive_failures as a live signal, plus the all-time failed/total
// ratio from transactions so a currently-quiet account with a bad history
// still surfaces near the top. Also carries an unread-from-owner message
// count so admins know which threads need a reply.
export async function listAllAccountsForAdmin() {
  const { rows } = await sql`
    SELECT
      a.*,
      u.email AS owner_email,
      u.full_name AS owner_full_name,
      COALESCE(t.total_tx, 0) AS total_tx,
      COALESCE(t.failed_tx, 0) AS failed_tx,
      CASE WHEN COALESCE(t.total_tx, 0) = 0 THEN 0
           ELSE ROUND(100.0 * t.failed_tx / t.total_tx, 1)
      END AS failure_rate_pct,
      COALESCE(m.unread_from_owner, 0) AS unread_from_owner
    FROM accounts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN (
      SELECT account_id,
             COUNT(*) AS total_tx,
             COUNT(*) FILTER (WHERE status = 'failed') AS failed_tx
      FROM transactions
      GROUP BY account_id
    ) t ON t.account_id = a.id
    LEFT JOIN (
      SELECT account_id, COUNT(*) AS unread_from_owner
      FROM messages
      WHERE sender_role = 'owner' AND read_at IS NULL
      GROUP BY account_id
    ) m ON m.account_id = a.id
    ORDER BY a.consecutive_failures DESC, failure_rate_pct DESC, a.created_at DESC
  `;
  return rows;
}

// Full "god view" for one account: the account itself, its owner, every
// transaction, and the admin_actions audit trail.
export async function getAccountActivityForAdmin(accountId) {
  const { rows: accountRows } = await sql`
    SELECT a.*, u.email AS owner_email, u.full_name AS owner_full_name, u.created_at AS owner_created_at
    FROM accounts a JOIN users u ON u.id = a.user_id
    WHERE a.id = ${accountId}
  `;
  const account = accountRows[0];
  if (!account) return null;

  const { rows: transactions } = await sql`
    SELECT * FROM transactions WHERE account_id = ${accountId} ORDER BY created_at DESC LIMIT 200
  `;
  const { rows: adminActions } = await sql`
    SELECT aa.*, u.email AS admin_email
    FROM admin_actions aa LEFT JOIN users u ON u.id = aa.admin_user_id
    WHERE aa.account_id = ${accountId}
    ORDER BY aa.created_at DESC
  `;
  return { account, transactions, adminActions };
}

// --- In-app chat (replaces the WhatsApp support button) ---------------------

export async function sendMessage({ accountId, senderRole, senderUserId, body }) {
  const { rows } = await sql`
    INSERT INTO messages (account_id, sender_role, sender_user_id, body)
    VALUES (${accountId}, ${senderRole}, ${senderUserId}, ${body})
    RETURNING *
  `;
  // Notify the developer when the admin messages them. (Admins see unread
  // counts computed live from messages, so no notification row is needed
  // in the other direction — see listAllAccountsForAdmin.)
  if (senderRole === "admin") {
    const account = await getAccountById(accountId);
    if (account) {
      await createNotification({
        userId: account.user_id,
        type: "message",
        title: "New message from Sendit support",
        body: body.slice(0, 140),
        relatedAccountId: accountId,
      });
    }
  }
  return rows[0];
}

export async function listMessages(accountId) {
  const { rows } = await sql`
    SELECT * FROM messages WHERE account_id = ${accountId} ORDER BY created_at ASC LIMIT 500
  `;
  return rows;
}

// Marks the *other* side's messages as read. readerRole='owner' clears
// unread admin messages (for the developer's own unread badge); readerRole
// ='admin' clears unread owner messages (for the admin's reply queue).
export async function markMessagesRead(accountId, readerRole) {
  const otherRole = readerRole === "admin" ? "owner" : "admin";
  await sql`
    UPDATE messages SET read_at = now()
    WHERE account_id = ${accountId} AND sender_role = ${otherRole} AND read_at IS NULL
  `;
}

export async function unreadMessageCountForOwner(userId) {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS count
    FROM messages m JOIN accounts a ON a.id = m.account_id
    WHERE a.user_id = ${userId} AND m.sender_role = 'admin' AND m.read_at IS NULL
  `;
  return rows[0]?.count || 0;
}

// --- Notifications ------------------------------------------------------------

export async function createNotification({ userId, type, title, body, relatedAccountId }) {
  await sql`
    INSERT INTO notifications (user_id, type, title, body, related_account_id)
    VALUES (${userId}, ${type}, ${title}, ${body || null}, ${relatedAccountId || null})
  `;
}

export async function listNotificationsForUser(userId, limit = 30) {
  const { rows } = await sql`
    SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows;
}

export async function unreadNotificationCount(userId) {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ${userId} AND read_at IS NULL
  `;
  return rows[0]?.count || 0;
}

export async function markNotificationsRead(userId) {
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
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

// --- Admin: platform-wide economic overview -----------------------------

// Everything an admin needs for a one-glance health check: how much real
// customer money has moved through developers' tills (not Sendit's own
// revenue), how many developers are on the platform, and how much Sendit
// itself has made from tokens/subscriptions/activations. Also a 14-day
// daily series for the trend chart.
export async function getAdminOverviewStats() {
  const { rows: totals } = await sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'stkpush' AND status = 'success'), 0) AS money_moved,
      COUNT(*) FILTER (WHERE type = 'stkpush' AND status = 'success') AS successful_stkpushes,
      COUNT(*) FILTER (WHERE type = 'stkpush') AS total_stkpushes,
      COALESCE(SUM(amount) FILTER (WHERE type = 'token_purchase' AND status = 'success'), 0) AS token_revenue,
      COALESCE(SUM(amount) FILTER (WHERE type = 'subscription' AND status = 'success'), 0) AS subscription_revenue,
      COALESCE(SUM(amount) FILTER (WHERE type = 'activation' AND status = 'success'), 0) AS activation_revenue
    FROM transactions
  `;

  const { rows: userCount } = await sql`SELECT COUNT(*)::int AS count FROM users`;
  const { rows: accountCount } = await sql`SELECT COUNT(*)::int AS count FROM accounts`;
  const { rows: activeAccountCount } = await sql`
    SELECT COUNT(*)::int AS count FROM accounts WHERE status NOT IN ('suspended', 'payment_failed')
  `;

  const { rows: dailySeries } = await sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COALESCE(SUM(amount) FILTER (WHERE type = 'stkpush' AND status = 'success'), 0) AS money_moved
    FROM transactions
    WHERE created_at >= now() - interval '14 days'
    GROUP BY 1
    ORDER BY 1
  `;

  const t = totals[0];
  return {
    moneyMoved: Number(t.money_moved),
    successfulStkpushes: Number(t.successful_stkpushes),
    totalStkpushes: Number(t.total_stkpushes),
    tokenRevenue: Number(t.token_revenue),
    subscriptionRevenue: Number(t.subscription_revenue),
    activationRevenue: Number(t.activation_revenue),
    totalUsers: userCount[0].count,
    totalAccounts: accountCount[0].count,
    activeAccounts: activeAccountCount[0].count,
    dailySeries: dailySeries.map((r) => ({ day: r.day, moneyMoved: Number(r.money_moved) })),
  };
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

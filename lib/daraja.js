// Thin wrapper around Safaricom's Daraja STK Push (Lipa na M-Pesa Online) API.
// Works for both the platform's own activation-fee collection and for each
// developer's own linked till/paybill.

function baseUrl(env) {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export async function getAccessToken({ consumerKey, consumerSecret, env }) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// phone must be in 2547XXXXXXXX format.
// `shortcode`/`passkey` authenticate the request — this is always Sendit's
// own Daraja app (PLATFORM_SHORTCODE / PLATFORM_PASSKEY), never a developer's.
// `partyB` is the destination till/paybill the money actually settles into —
// this is the developer's linked account. Safaricom only allows this when
// the developer has registered Sendit's Daraja app as an authorized operator
// against their till/paybill via the M-Pesa Business Portal.
export async function stkPush({
  env,
  consumerKey,
  consumerSecret,
  shortcode,
  passkey,
  partyB,
  transactionType,
  amount,
  phone,
  callbackUrl,
  accountReference,
  transactionDesc,
}) {
  const token = await getAccessToken({ consumerKey, consumerSecret, env });
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: transactionType || "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: partyB || shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference || "STKGateway",
    TransactionDesc: transactionDesc || "Payment",
  };

  const res = await fetch(`${baseUrl(env)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage || data.ResponseDescription || "STK push request failed");
  }
  return data; // contains MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription
}

// Direct status query (Safaricom's "STK Push Query" API) — lets a caller
// ask Safaricom "what happened to this CheckoutRequestID" on demand,
// instead of only waiting for the callback to arrive. Same shortcode/passkey
// that authenticated the original push must be used to query it.
export async function stkPushQuery({ consumerKey, consumerSecret, shortcode, passkey, env, checkoutRequestId }) {
  const token = await getAccessToken({ consumerKey, consumerSecret, env });
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const res = await fetch(`${baseUrl(env)}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  return res.json();
  // While the push is still awaiting a PIN entry, Safaricom responds with an
  // error shape (errorCode/errorMessage, e.g. "still processing the request")
  // rather than a ResultCode — mapQueryStatus below treats that as pending.
}

// Maps a stkPushQuery response to 'success' | 'failed' | 'pending'. Never
// throws — an ambiguous/error-shaped response is reported as pending so the
// caller just polls again rather than mistaking a transient state for a
// real failure.
export function mapQueryStatus(data) {
  if (!data) return "pending";
  if (data.errorCode || data.errorMessage) return "pending";
  const code = data.ResultCode === undefined || data.ResultCode === null ? null : Number(data.ResultCode);
  if (code === null) return "pending";
  return code === 0 ? "success" : "failed";
}

// Normalizes a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX
export function normalizePhone(input) {
  let p = String(input).trim().replace(/\s+/g, "").replace(/^\+/, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

// Parses the STK callback body Safaricom POSTs to your CallBackURL
export function parseStkCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  const result = {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    success: cb.ResultCode === 0,
    mpesaReceipt: null,
    amount: null,
    phone: null,
  };
  const items = cb.CallbackMetadata?.Item || [];
  for (const item of items) {
    if (item.Name === "MpesaReceiptNumber") result.mpesaReceipt = item.Value;
    if (item.Name === "Amount") result.amount = item.Value;
    if (item.Name === "PhoneNumber") result.phone = String(item.Value);
  }
  return result;
}

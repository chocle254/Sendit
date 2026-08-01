// B2C (payout to a phone number) and B2B (payout to a till/paybill) —
// this is the second hop of every transaction: money always lands in
// Sendit's own paybill/till first via STK Push (lib/daraja.js), then gets
// pushed out to the developer's chosen destination here, minus Sendit's fee.
//
// Both APIs need a `SecurityCredential`: your initiator password encrypted
// with Safaricom's PUBLIC certificate (not the passkey/consumer-secret used
// elsewhere). Download the cert once from:
//   sandbox:    https://developer.safaricom.co.ke/sites/default/files/cert/cert_sandbox/cert.cer
//   production: https://developer.safaricom.co.ke/sites/default/files/cert/cert_prod/cert.cer
// Save it as e.g. certs/sandbox.cer / certs/production.cer in this repo (or
// point PLATFORM_CERT_PATH at wherever you keep it) and set
// PLATFORM_INITIATOR_NAME / PLATFORM_INITIATOR_PASSWORD from the M-Pesa Org
// Portal (Test Credentials page for sandbox, your own portal user for prod).

import crypto from "crypto";
import fs from "fs";
import { getAccessToken } from "./daraja";

function baseUrl(env) {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

// RSA/PKCS1 encryption of the initiator password using Safaricom's public
// certificate — this is what Daraja calls the SecurityCredential. Required
// for every B2C/B2B/reversal/balance call; NOT the same as the STK password.
export function getSecurityCredential({ initiatorPassword, certPath }) {
  const cert = fs.readFileSync(certPath, "utf8");
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(initiatorPassword)
  );
  return encrypted.toString("base64");
}

// Pays a developer's own phone number (B2C). Use for account_type = 'phone'.
export async function b2cPayout({
  env,
  consumerKey,
  consumerSecret,
  shortcode,
  initiatorName,
  securityCredential,
  amount,
  phone,
  remarks,
  occasion,
  resultUrl,
  timeoutUrl,
  commandId, // 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment'
}) {
  const token = await getAccessToken({ consumerKey, consumerSecret, env });
  const res = await fetch(`${baseUrl(env)}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: crypto.randomUUID(),
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandId || "BusinessPayment",
      Amount: Math.round(amount),
      PartyA: shortcode,
      PartyB: phone,
      Remarks: (remarks || "Payout").slice(0, 100),
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
      Occasion: (occasion || "Payout").slice(0, 100),
    }),
  });
  const data = await res.json();
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage || data.ResponseDescription || "B2C payout request failed");
  }
  return data; // contains ConversationID, OriginatorConversationID, ResponseCode
}

// Pays another business's till (BusinessBuyGoods) or paybill (BusinessPayBill).
// Use for account_type = 'till' | 'paybill'.
export async function b2bPayout({
  env,
  consumerKey,
  consumerSecret,
  shortcode,
  initiatorName,
  securityCredential,
  amount,
  partyB, // developer's till or paybill number
  accountReference, // required for paybill destinations, ignored for till
  remarks,
  resultUrl,
  timeoutUrl,
  isPaybill,
}) {
  const token = await getAccessToken({ consumerKey, consumerSecret, env });
  const res = await fetch(`${baseUrl(env)}/mpesa/b2b/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: isPaybill ? "BusinessPayBill" : "BusinessBuyGoods",
      SenderIdentifierType: "4",
      RecieverIdentifierType: "4",
      Amount: Math.round(amount),
      PartyA: shortcode,
      PartyB: partyB,
      AccountReference: isPaybill ? (accountReference || "Payout") : undefined,
      Requester: undefined,
      Remarks: (remarks || "Payout").slice(0, 100),
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.errorCode) {
    throw new Error(data.errorMessage || data.ResponseDescription || "B2B payout request failed");
  }
  return data; // contains ConversationID, OriginatorConversationID, ResponseCode
}

// Parses the async result Safaricom posts to ResultURL for both B2C and B2B.
// Shape is the same for both ("Result" wrapper), unlike the STK callback.
export function parsePayoutResult(body) {
  const r = body?.Result;
  if (!r) return null;
  const out = {
    conversationId: r.ConversationID,
    originatorConversationId: r.OriginatorConversationID,
    resultCode: r.ResultCode,
    resultDesc: r.ResultDesc,
    success: r.ResultCode === 0,
    receipt: null,
  };
  const items = r.ResultParameters?.ResultParameter || [];
  for (const item of items) {
    if (item.Key === "TransactionReceipt" || item.Key === "TransactionID") out.receipt = item.Value;
  }
  return out;
}

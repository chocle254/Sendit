import { parseStkCallback } from "../../../lib/daraja";
import { getTransactionByCheckoutId, completeTransaction, getAccountById, startOrExtendPlan, markAccountFailed } from "../../../lib/db";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { token } = req.query;
    const result = parseStkCallback(req.body);
    if (!result) return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const txn = await getTransactionByCheckoutId(result.checkoutRequestId);
    if (!txn || txn.type !== "subscription") {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const account = await getAccountById(txn.account_id);
    if (!account || !token || !timingSafeStringEqual(token, account.callback_token)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await completeTransaction({
      checkoutRequestId: result.checkoutRequestId,
      status: result.status, // 'success' | 'cancelled' | 'failed'
      mpesaReceipt: result.mpesaReceipt,
      resultDesc: result.resultDesc,
    });

    if (result.success) {
      // account_reference was set as "SenditPlan:monthly" / "SenditPlan:yearly" at checkout time.
      const planType = (txn.account_reference || "").split(":")[1];
      if (planType) await startOrExtendPlan(account.id, planType);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("subscription callback failed:", err);
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

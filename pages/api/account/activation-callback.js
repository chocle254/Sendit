import { parseStkCallback } from "../../../lib/daraja";
import { getTransactionByCheckoutId, completeTransaction, activateAccount, markAccountFailed, getAccountById } from "../../../lib/db";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { token } = req.query;
    const result = parseStkCallback(req.body);
    if (!result) return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const txn = await getTransactionByCheckoutId(result.checkoutRequestId);
    if (!txn || txn.type !== "activation") {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const account = await getAccountById(txn.account_id);
    if (!account || !token || !timingSafeStringEqual(token, account.callback_token)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await completeTransaction({
      checkoutRequestId: result.checkoutRequestId,
      status: result.success ? "success" : "failed",
      mpesaReceipt: result.mpesaReceipt,
      resultDesc: result.resultDesc,
    });

    if (result.success) {
      await activateAccount(account.id);
    } else {
      await markAccountFailed(account.id);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("activation callback failed:", err);
    // Always 200 to Safaricom even on our own error, or they'll retry aggressively.
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

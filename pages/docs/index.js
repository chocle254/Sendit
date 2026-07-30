import { useState } from "react";
import Head from "next/head";
import Logo from "../../components/Logo";

const TABS = ["Getting Started", "API Reference", "Webhooks"];

export default function Docs() {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");

  const keyDisplay = apiKey || "sk_live_YOUR_API_KEY";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Head><title>Sendit Docs</title></Head>
      <Logo size={32} />
      <h1 className="text-2xl font-bold mt-6 mb-2">Developer Docs</h1>
      <p className="text-gray-600 mb-6">
        Enter your Sendit email and API key below (only used to fill in the examples on this page — nothing is sent anywhere).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 bg-gray-50 p-4 rounded-lg">
        <input
          className="border rounded px-3 py-2"
          placeholder="Your Sendit email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Your API key (sk_live_...)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="flex gap-2 border-b mb-6">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === i ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <GettingStarted email={email} />}
      {tab === 1 && <ApiReference apiKey={keyDisplay} />}
      {tab === 2 && <Webhooks />}
    </div>
  );
}

function GettingStarted({ email }) {
  return (
    <div className="prose max-w-none">
      <h2>1. Create an account</h2>
      <p>Sign up{email ? ` as ${email}` : ""} at <code>/signup</code>.</p>

      <h2>2. Link your till/paybill</h2>
      <p>
        In your dashboard, go to <strong>Linked accounts</strong> and enter your till/paybill number
        plus your own Daraja app credentials (consumer key/secret, shortcode, passkey — from your
        Safaricom developer account).
      </p>

      <h2>3. Get your API key</h2>
      <p>
        New accounts start on a <strong>free trial — 25 STK push requests</strong> (successful or
        failed, both count) with no charge. Your API key is available immediately on the dashboard.
      </p>

      <h2>4. Activate for continued use</h2>
      <p>
        Once your 25 free requests are used, or after 30 days from activation, you'll need to pay a
        one-time KES 350 fee via <strong>Activate account</strong> to keep using the API for another
        30 days.
      </p>

      <h2>5. Call the API</h2>
      <p>Send a request to <code>POST /api/v1/stkpush</code> — see the API Reference tab.</p>

      <h2>6. Register a webhook</h2>
      <p>Add a webhook URL in your dashboard to get notified when a payment completes or fails.</p>
    </div>
  );
}

function ApiReference({ apiKey }) {
  const example = `curl -X POST https://your-sendit-domain.com/api/v1/stkpush \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "254712345678",
    "amount": 100,
    "account_reference": "Order1234",
    "transaction_desc": "Payment for order"
  }'`;

  return (
    <div className="prose max-w-none">
      <h2>POST /api/v1/stkpush</h2>
      <p>Triggers an STK push (M-Pesa PIN prompt) to a customer's phone.</p>

      <h3>Headers</h3>
      <ul>
        <li><code>Authorization: Bearer &lt;api_key&gt;</code> — required</li>
        <li><code>Content-Type: application/json</code></li>
      </ul>

      <h3>Body</h3>
      <table>
        <thead><tr><th>Field</th><th>Type</th><th>Required</th></tr></thead>
        <tbody>
          <tr><td>phone</td><td>string, 07xx/2547xx</td><td>yes</td></tr>
          <tr><td>amount</td><td>number, positive</td><td>yes</td></tr>
          <tr><td>account_reference</td><td>string</td><td>no</td></tr>
          <tr><td>transaction_desc</td><td>string</td><td>no</td></tr>
        </tbody>
      </table>

      <h3>Example</h3>
      <pre><code>{example}</code></pre>

      <h3>Response (200)</h3>
      <pre><code>{`{
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing.",
  "MerchantRequestID": "...",
  "CheckoutRequestID": "..."
}`}</code></pre>

      <h3>Error responses</h3>
      <ul>
        <li><code>401</code> — missing/invalid API key</li>
        <li><code>402</code> — trial used up, activation expired, or on parole with insufficient tokens</li>
        <li><code>400</code> — missing/invalid phone or amount</li>
        <li><code>502</code> — Daraja/Safaricom rejected the request</li>
      </ul>
    </div>
  );
}

function Webhooks() {
  return (
    <div className="prose max-w-none">
      <h2>Webhook payload</h2>
      <p>
        When Safaricom confirms (or rejects) an STK push, Sendit forwards this JSON payload via
        POST to every webhook URL registered on your account:
      </p>
      <pre><code>{`{
  "ResponseCode": 0,
  "ResponseDescription": "The service request is processed successfully.",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "MpesaReceiptNumber": "NLJ7RT61SV",
  "Amount": 100,
  "PhoneNumber": "254712345678"
}`}</code></pre>

      <h3>Reading the result</h3>
      <p><code>ResponseCode === 0</code> means success. Anything else means the push failed or was
      cancelled — <code>ResponseDescription</code> explains why.</p>

      <h3>Registering a webhook</h3>
      <p>Add your webhook URL from the dashboard's Webhooks page. You can register multiple URLs.</p>

      <h3>Security note</h3>
      <p>
        Webhook requests aren't signed yet — treat the body as informational and verify the actual
        transaction status via your dashboard/transactions API before releasing goods or services
        for high-value orders. Signed webhooks (HMAC) are on the roadmap.
      </p>
    </div>
  );
}

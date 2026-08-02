import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "../../components/Logo";

const TABS = ["Getting Started", "API Reference", "Webhooks"];

export default function Docs() {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");

  const keyDisplay = apiKey || "sk_live_YOUR_API_KEY";

  return (
    <div className="min-h-screen bg-base text-white">
      <Head><title>Sendit Docs</title></Head>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/"><Logo size={32} /></Link>
        <h1 className="font-display text-2xl font-bold mt-6 mb-2">Developer Docs</h1>
        <p className="text-muted mb-6">
          Enter your Sendit email and API key below (only used to fill in the examples on this page — nothing is sent anywhere).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 glass p-4 rounded-lg shadow-neo-sm">
          <input
            className="bg-base/60 border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
            placeholder="Your Sendit email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="bg-base/60 border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
            placeholder="Your API key (sk_live_...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="relative flex gap-2 border-b border-line mb-6">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === i ? "text-mint" : "text-muted hover:text-white"
              }`}
            >
              {t}
              {tab === i && (
                <motion.div
                  layoutId="docs-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-mint rounded-full shadow-glow-mint"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 0 && <GettingStarted email={email} />}
          {tab === 1 && <ApiReference apiKey={keyDisplay} />}
          {tab === 2 && <Webhooks />}
        </motion.div>
      </div>
    </div>
  );
}

function GettingStarted({ email }) {
  return (
    <Prose>
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
        Your <strong>first</strong> linked account starts on a free trial — <strong>5 STK push
        requests</strong> (successful or failed, both count), no charge. This free tier is granted
        once per Sendit user, not per account — accounts linked after your first one need a
        subscription or purchased tokens from the start. Your API key is available immediately on
        the dashboard either way.
      </p>

      <h2>4. Subscribe or buy tokens for continued use</h2>
      <p>
        Once your free requests are used, choose either a subscription for unlimited STK pushes —
        <strong> KES 300/month</strong> or <strong>KES 1,500/year</strong> — or buy tokens, where
        1 token = KES 1 = 1 transaction (minimum 50 tokens per purchase). Do this from{" "}
        <strong>Linked accounts</strong> in the dashboard.
      </p>

      <h2>5. Call the API</h2>
      <p>Send a request to <code>POST /api/v1/stkpush</code> — see the API Reference tab.</p>

      <h2>6. Register a webhook</h2>
      <p>Add a webhook URL in your dashboard to get notified when a payment completes or fails.</p>
    </Prose>
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
    <Prose>
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
    </Prose>
  );
}

function Webhooks() {
  return (
    <Prose>
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
    </Prose>
  );
}

// Hand-styled in place of the Tailwind Typography plugin (not installed) —
// keeps the docs on the same dark/glass system as the rest of the app
// instead of an unstyled `prose` class with no plugin behind it.
function Prose({ children }) {
  return (
    <div
      className="text-[15px] leading-relaxed text-white/90
        [&>h2]:font-display [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-white [&>h2]:mt-8 [&>h2]:mb-2 [&>h2]:first:mt-0
        [&>h3]:font-display [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mt-6 [&>h3]:mb-2
        [&>p]:text-muted [&>p]:my-2
        [&_strong]:text-white [&_strong]:font-medium
        [&_code]:font-mono [&_code]:text-xs [&_code]:bg-panel2 [&_code]:border [&_code]:border-line [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-mint
        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ul]:text-muted [&>ul]:my-2
        [&>pre]:glass [&>pre]:shadow-neo-sm [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:my-3 [&>pre]:overflow-x-auto [&>pre_code]:bg-transparent [&>pre_code]:border-0 [&>pre_code]:p-0 [&>pre_code]:text-white/90
        [&>table]:w-full [&>table]:my-3 [&>table]:text-sm [&>table]:border-collapse
        [&_th]:text-left [&_th]:text-muted [&_th]:font-normal [&_th]:border-b [&_th]:border-line [&_th]:py-2 [&_th]:pr-4
        [&_td]:border-b [&_td]:border-line/50 [&_td]:py-2 [&_td]:pr-4"
    >
      {children}
    </div>
  );
}

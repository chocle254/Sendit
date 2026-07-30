import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-base text-white">
      <nav className="flex items-center justify-between max-w-5xl mx-auto px-6 py-6">
        <div className="font-mono text-mint font-semibold tracking-tight">stk://gateway</div>
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="text-muted hover:text-white">Log in</Link>
          <Link href="/signup" className="bg-mint text-base px-4 py-2 rounded-md font-medium hover:opacity-90">
            Get started
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="max-w-2xl">
          <div className="inline-block text-xs font-mono text-mint bg-mintdim px-3 py-1 rounded-full mb-6">
            M-Pesa STK Push, wrapped for developers
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
            Add M-Pesa payments to your app
            <span className="text-mint"> without touching Daraja directly.</span>
          </h1>
          <p className="text-muted text-lg mt-6 leading-relaxed">
            Link your till or paybill once, and get a single API key that triggers
            STK push prompts, tracks every transaction, and forwards results to
            your own webhook — no OAuth tokens or callback plumbing to manage.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/signup" className="bg-mint text-base px-6 py-3 rounded-md font-medium hover:opacity-90">
              Create an account
            </Link>
            <a href="#how" className="border border-line px-6 py-3 rounded-md text-sm hover:border-mint">
              See how it works
            </a>
          </div>
        </div>

        <div id="how" className="grid md:grid-cols-3 gap-6 mt-24">
          <Step n="01" title="Link an account" body="Enter your till or paybill number and your own Daraja app credentials." />
          <Step n="02" title="Pay the one-time activation fee" body="A KES 350 STK prompt confirms the account is really yours." />
          <Step n="03" title="Get your API key" body="Call one endpoint from your app. We handle the rest and notify your webhook." />
        </div>

        <div className="mt-24 bg-panel border border-line rounded-lg p-6 font-mono text-sm overflow-x-auto">
          <div className="text-muted mb-2">// trigger a payment prompt</div>
          <pre className="text-white">{`curl -X POST https://your-domain.com/api/v1/stkpush \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "2547XXXXXXXX",
    "amount": 100,
    "account_reference": "ORDER-1029"
  }'`}</pre>
        </div>
      </main>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="border-t border-line pt-4">
      <div className="text-mint font-mono text-sm">{n}</div>
      <div className="font-medium mt-2">{title}</div>
      <div className="text-muted text-sm mt-2 leading-relaxed">{body}</div>
    </div>
  );
}

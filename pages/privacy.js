import Head from "next/head";
import Link from "next/link";
import Logo from "../components/Logo";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-base text-white">
      <Head><title>Privacy Policy — Sendit</title></Head>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/"><Logo size={32} /></Link>
        <h1 className="font-display text-2xl font-bold mt-6 mb-1">Privacy Policy</h1>
        <p className="text-muted text-sm mb-8">Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-6 text-sm leading-relaxed text-white/90">
          <Section title="1. Information we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account information:</strong> your full name, email address, and password
                (stored as a salted hash, never in plain text) when you sign up.</li>
              <li><strong>Business/account information:</strong> business name, account type, and
                your till, paybill, or payout phone number when you link an account.</li>
              <li><strong>Transaction data:</strong> the phone numbers you request STK pushes to,
                amounts, M-Pesa receipt numbers, and payment status/result descriptions returned by
                Safaricom.</li>
              <li><strong>Support messages:</strong> the content of any in-app chat messages between
                you and Sendit support/admin.</li>
              <li><strong>Technical data:</strong> API request logs, timestamps, and error details
                needed to operate and troubleshoot the service.</li>
            </ul>
          </Section>

          <Section title="2. How we use your information">
            We use this information to operate your account, process STK push requests through
            Safaricom's Daraja API, credit successful payments, detect fraud or abuse (including
            excessive failure rates that may trigger account review), respond to support requests,
            and send you account-related notifications (e.g. a message from support, a subscription
            confirmation, or an account status change).
          </Section>

          <Section title="3. Sharing with third parties">
            <p className="mb-2">We share the minimum data necessary with:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Safaricom (M-Pesa Daraja API):</strong> the phone number, amount, and
                account reference for each STK push you initiate, in order to process the payment.</li>
              <li><strong>Your own webhook endpoint:</strong> transaction status updates you've
                configured Sendit to send.</li>
            </ul>
            <p className="mt-2">We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="4. Data retention">
            We retain account and transaction data for as long as your account is active and for a
            reasonable period afterward to comply with financial recordkeeping obligations and
            resolve disputes. You can request deletion of your account and associated data at any
            time by contacting support, subject to records we're legally required to keep.
          </Section>

          <Section title="5. Security">
            Passwords are hashed and salted, never stored in plain text. API keys act as bearer
            credentials — keep yours confidential. We use encrypted connections (HTTPS) for all
            traffic to and from Sendit.
          </Section>

          <Section title="6. Your rights">
            You may access, correct, or request deletion of your personal data, and you may
            withdraw consent for non-essential communications at any time. To exercise these rights,
            contact us through the in-app chat.
          </Section>

          <Section title="7. Children">
            Sendit is not directed at, and is not intended for use by, anyone under 18. We do not
            knowingly collect data from minors.
          </Section>

          <Section title="8. Changes to this policy">
            We may update this Privacy Policy from time to time. Material changes will be reflected
            by the "last updated" date above.
          </Section>

          <Section title="9. Contact">
            Questions about this Privacy Policy can be sent through the in-app chat.
          </Section>

          <p className="text-muted text-xs pt-4 border-t border-line/60">
            See also our <Link href="/terms" className="text-mint hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold mb-2">{title}</h2>
      <div className="text-white/80">{children}</div>
    </section>
  );
}

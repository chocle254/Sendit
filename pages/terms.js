import Head from "next/head";
import Link from "next/link";
import Logo from "../components/Logo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-base text-white">
      <Head><title>Terms of Service — Sendit</title></Head>
      <div className="max-w-2xl mx-auto px-4 pt-10">
        <Link href="/"><Logo size={32} /></Link>
      </div>

      {/* A4-proportioned sheet (210:297 aspect) with a paper edge/shadow, sitting on
          the dark app background like a printed page rather than themed to match it. */}
      <div className="max-w-[794px] mx-auto px-4 py-10">
        <div
          className="bg-white text-[#1a1a1a] rounded-sm mx-auto px-8 sm:px-14 py-12 sm:py-16"
          style={{
            minHeight: "1123px", // A4 at 96dpi: 794x1123
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <h1 className="font-display text-2xl font-bold mb-1">Terms of Service</h1>
          <p className="text-[#6b6862] text-sm mb-8">Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>

          <div className="space-y-6 text-sm leading-relaxed text-[#2a2a2a]">
            <Section title="1. Who can use Sendit">
              Sendit is available to individuals and businesses who are 18 years of age or older and
              capable of entering a binding agreement under the laws of Kenya. By creating an account
              you confirm you meet this requirement.
            </Section>

            <Section title="2. What Sendit does">
              Sendit is an API that lets developers trigger M-Pesa STK Push (Lipa na M-Pesa Online)
              payment prompts to their customers' phones, and receive webhook notifications when a
              payment succeeds, fails, or is cancelled. Sendit is a technical intermediary — it is not
              a bank, a payment processor of record, or a party to the underlying sale between you and
              your customer.
            </Section>

            <Section title="3. Accounts and linked tills/paybills">
              You may link a till or paybill number you are authorized to receive payments on. You are
              responsible for separately authorizing Sendit's Daraja application as an operator on
              that till or paybill via the M-Pesa Business Portal. You are responsible for the accuracy
              of the account details you provide and for keeping your API key confidential — you are
              responsible for all activity that occurs using your API key.
              <p className="mt-2">
                Before linking an account, you must review and confirm the till/paybill/account number
                details you enter. <strong>Sendit cannot reverse or refund a payment that settles to a
                till, paybill, or account number you entered incorrectly.</strong> This is true even if
                the error is a typo, an outdated number, or a mismatch between the number and the
                business you intended. You are solely responsible for verifying these details are
                correct before your account starts receiving real customer payments.
              </p>
            </Section>

            <Section title="4. Free tier, subscriptions, and tokens">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Each Sendit user receives a one-time free tier of 5 STK push transactions, granted
                  to the first account they link. Accounts linked after that — including a new account
                  linked after deleting previous ones — do not receive another free tier.</li>
                <li>Continued use beyond the free tier requires either an active monthly (KES 300) or
                  yearly (KES 1,500) subscription for unlimited transactions, or purchased tokens
                  (minimum 50, 1 token = KES 1 = 1 transaction).</li>
                <li>Prices are in Kenyan Shillings and may change; we'll display the current price
                  before you pay.</li>
                <li>Payments are processed via M-Pesa STK Push. A completed charge is final; disputes
                  should be raised through in-app support.</li>
              </ul>
            </Section>

            <Section title="5. Parole and suspension">
              If an account accumulates a high number of consecutive failed transactions, it may be
              placed on parole, which restricts further transactions until token balance requirements
              are met and can only be lifted by a Sendit admin. Sendit may also suspend an account for
              suspected abuse, fraud, violation of these Terms, or at Safaricom's direction. A
              suspended account cannot send STK pushes until reinstated. You may contact support
              in-app to ask about or appeal a suspension.
            </Section>

            <Section title="6. Acceptable use">
              You may not use Sendit to collect payment for anything illegal under Kenyan law,
              including but not limited to fraud, unlicensed gambling, or the sale of prohibited goods.
              You may not attempt to circumvent usage limits, probe or disrupt the service, or resell
              API access without our written consent.
            </Section>

            <Section title="7. Availability">
              Sendit depends on Safaricom's Daraja platform and third-party infrastructure providers.
              We aim for high availability but do not guarantee uninterrupted service, and we are not
              liable for downtime, delays, or failures originating from Safaricom or other providers
              outside our control.
            </Section>

            <Section title="8. Limitation of liability">
              To the maximum extent permitted by law, Sendit's total liability for any claim arising
              from your use of the service is limited to the fees you paid to Sendit in the three
              months preceding the claim. Sendit is not liable for indirect, incidental, or
              consequential damages, including lost profits or lost data.
            </Section>

            <Section title="9. Changes to these Terms">
              We may update these Terms from time to time. Continued use of Sendit after an update
              constitutes acceptance of the revised Terms. Material changes will be reflected by the
              "last updated" date above.
            </Section>

            <Section title="10. Contact">
              Questions about these Terms can be sent through the in-app chat, or to the email address
              associated with your Sendit account's support channel.
            </Section>

            <p className="text-[#6b6862] text-xs pt-4 border-t border-black/10">
              See also our <Link href="/privacy" className="text-[#0e7a5f] hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold mb-2 text-[#111]">{title}</h2>
      <div className="text-[#2a2a2a]/90">{children}</div>
    </section>
  );
}

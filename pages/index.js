import Link from "next/link";
import { motion } from "framer-motion";
import Signal from "../components/Signal";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.08 },
  }),
};

export default function Home() {
  return (
    <div className="min-h-screen bg-base text-white overflow-hidden relative">
      {/* Ambient signal rings drifting behind the hero — the same "push
          landing on a phone" motif as the Signal component, blown up and
          softened into atmosphere rather than a stock gradient blob. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-mint/10 blur-3xl animate-float" />
        <div
          className="absolute top-64 -left-32 h-[360px] w-[360px] rounded-full bg-amber/10 blur-3xl animate-float"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <nav className="relative z-10 sticky top-0 bg-base/70 backdrop-blur-xl border-b border-line/60">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
          <div className="font-mono text-mint font-semibold tracking-tight">stk://gateway</div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-white transition-colors">Log in</Link>
            <Link
              href="/signup"
              className="bg-mint text-base px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="max-w-2xl">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="inline-flex items-center gap-2 text-xs font-mono text-mint bg-mintdim px-3 py-1 rounded-full mb-6"
          >
            <Signal color="mint" />
            M-Pesa STK Push, wrapped for developers
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight"
          >
            Add M-Pesa payments to your app
            <span className="text-mint"> without touching Daraja directly.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="text-muted text-lg mt-6 leading-relaxed"
          >
            Link your till or paybill once, and get a single API key that triggers
            STK push prompts, tracks every transaction, and forwards results to
            your own webhook — no OAuth tokens or callback plumbing to manage.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="flex gap-4 mt-8">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="block bg-mint text-base px-6 py-3 rounded-md font-medium shadow-glow-mint"
              >
                Create an account
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <a
                href="#how"
                className="block border border-line px-6 py-3 rounded-md text-sm hover:border-mint transition-colors"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </div>

        <div id="how" className="grid md:grid-cols-3 gap-5 mt-24">
          <Step n="01" title="Link an account" body="Enter your till or paybill number and your own Daraja app credentials." delay={0} />
          <Step n="02" title="Pay the one-time activation fee" body="A KES 350 STK prompt confirms the account is really yours." delay={1} />
          <Step n="03" title="Get your API key" body="Call one endpoint from your app. We handle the rest and notify your webhook." delay={2} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-24 glass rounded-xl overflow-hidden shadow-glass"
        >
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line/60">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-3 text-xs text-muted font-mono">trigger-payment.sh</span>
          </div>
          <pre className="p-6 font-mono text-sm overflow-x-auto leading-relaxed">
            <code>
              <span className="text-muted">curl -X POST</span> <span className="text-mint">https://your-domain.com/api/v1/stkpush</span> \{"\n"}
              {"  "}-H <span className="text-amber">&quot;Authorization: Bearer sk_live_...&quot;</span> \{"\n"}
              {"  "}-H <span className="text-amber">&quot;Content-Type: application/json&quot;</span> \{"\n"}
              {"  "}-d <span className="text-amber">{"'"}</span>{"{"}
              {"\n    "}<span className="text-white">&quot;phone&quot;</span>: <span className="text-amber">&quot;2547XXXXXXXX&quot;</span>,
              {"\n    "}<span className="text-white">&quot;amount&quot;</span>: <span className="text-mint">100</span>,
              {"\n    "}<span className="text-white">&quot;account_reference&quot;</span>: <span className="text-amber">&quot;ORDER-1029&quot;</span>
              {"\n  "}{"}"}<span className="text-amber">{"'"}</span>
            </code>
          </pre>
        </motion.div>
      </main>
    </div>
  );
}

function Step({ n, title, body, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay: delay * 0.1 }}
      whileHover={{ y: -3 }}
      className="glass rounded-lg p-5 shadow-neo-sm"
    >
      <div className="text-mint font-mono text-sm">{n}</div>
      <div className="font-medium mt-2">{title}</div>
      <div className="text-muted text-sm mt-2 leading-relaxed">{body}</div>
    </motion.div>
  );
}

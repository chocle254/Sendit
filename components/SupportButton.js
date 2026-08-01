import { motion } from "framer-motion";

export default function SupportButton() {
  const phone = "254788564841";
  const message = encodeURIComponent("Hi Sendit support, I need help with my account.");
  return (
    <motion.a
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2, boxShadow: "0 10px 26px -6px rgba(37,211,102,0.55)" }}
      whileTap={{ scale: 0.96 }}
      className="fixed z-50 bottom-24 right-4 md:bottom-5 md:right-5 flex items-center gap-2 px-[18px] py-3 rounded-full font-semibold text-sm no-underline text-white"
      style={{
        background: "#25D366",
        boxShadow: "0 4px 16px -4px rgba(37,211,102,0.4)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.15c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.16-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.15.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.76 1.26 1.64 2.04 1.13 1 2.08 1.32 2.37 1.47.29.15.46.13.63-.08.17-.2.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.64.77 1.92.91.29.15.48.22.55.34.07.13.07.75-.17 1.43z"/>
      </svg>
      Chat with support
    </motion.a>
  );
}

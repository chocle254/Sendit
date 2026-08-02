import Head from "next/head";
import "../styles/globals.css";
import ChatWidget from "../components/ChatWidget";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Sendit — M-Pesa STK Push API for Developers</title>
      </Head>
      <Component {...pageProps} />
      <ChatWidget />
    </>
  );
}

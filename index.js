import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

// ===== CONFIG =====
const TELEGRAM_TOKEN = "8306258924:AAFXGYN-IOPqGneRgmZqahnvmMwxORL3_wE";
const TELEGRAM_CHAT_ID = 1358730050;

const WALLET = new PublicKey(
  "6DtEedWf9Wk5hA7Xth82Eq441yf5DA4aGLqaQAVfDokm"
);

const RPC_URL =
  "https://mainnet.helius-rpc.com/?api-key=0a0e3a74-a54b-486e-b002-9ccd3bc2863b";

// ==================

const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

// ONLINE MESSAGE
(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `⚡ BOT ONLINE\n👛 Wallet: ${WALLET.toBase58()}`
    );
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
})();

// WATCHER
const seen = new Set();

setInterval(async () => {
  try {
    const sigs = await connection.getSignaturesForAddress(WALLET, {
      limit: 5,
    });

    for (const s of sigs) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);

      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;

      const instructions = tx.transaction.message.instructions || [];

      for (const ix of instructions) {
        if (
          ix.program === "spl-token" &&
          ix.parsed?.type === "initializeMint"
        ) {
          const mint = ix.parsed.info.mint;

          const msg =
            `🚀 NEW TOKEN CREATED\n\n` +
            `🪙 Mint: ${mint}\n\n` +
            `🔥 Pump.fun:\nhttps://pump.fun/${mint}\n\n` +
            `🔎 Solscan:\nhttps://solscan.io/token/${mint}`;

          await bot.sendMessage(TELEGRAM_CHAT_ID, msg);
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);
  }
}, 15000);
setInterval(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "💓 Бот живий і продовжує слідкувати за гаманцем"
    );
    console.log("Heartbeat sent");
  } catch (e) {
    console.error("Heartbeat error:", e.message);
  }
}, 60 * 60 * 1000);

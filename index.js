import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

/* ===== ENV ===== */
const {
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID,
  WALLET,
  RPC_URL,
} = process.env;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || !WALLET || !RPC_URL) {
  console.error("❌ ENV VARIABLES MISSING");
  process.exit(1);
}

/* ===== INIT ===== */
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const connection = new Connection(RPC_URL, "confirmed");
const wallet = new PublicKey(WALLET);

console.log("BOT STARTING");
console.log("Watching wallet:", wallet.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
const seen = new Set();
let onlineSent = false;

/* ===== /status ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  const uptime = Date.now() - startTime;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 BOT STATUS\n\n` +
    `✅ Online: YES\n` +
    `⏱ Uptime: ${h}h ${m}m\n\n` +
    `👛 Wallet:\n${wallet.toBase58()}`
  );
});

/* ===== ONLINE MESSAGE ===== */
setTimeout(async () => {
  if (onlineSent) return;
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `⚡ BOT ONLINE\n👛 Wallet:\n${wallet.toBase58()}`
    );
    onlineSent = true;
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
}, 3000);

/* ===== WATCH WALLET ===== */
setInterval(async () => {
  try {
    const sigs = await connection.getSignaturesForAddress(wallet, { limit: 5 });

    for (const s of sigs) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);

      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;

      const instructions = tx.transaction.message.instructions ?? [];

      for (const ix of instructions) {
        if (
          ix.program === "spl-token" &&
          ix.parsed?.type === "initializeMint"
        ) {
          const mint = ix.parsed.info.mint;

          await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `🚀 NEW TOKEN CREATED\n\n` +
            `🪙 Mint: ${mint}\n\n` +
            `🔥 Pump.fun:\nhttps://pump.fun/${mint}\n\n` +
            `🔎 Solscan:\nhttps://solscan.io/token/${mint}`
          );

          console.log("NEW TOKEN:", mint);
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `🚨 BOT ERROR\n\n${e.message}`
    );
  }
}, 15000);

/* ===== HEARTBEAT ===== */
setInterval(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "💓 Бот живий і слідкує за гаманцем"
    );
    console.log("Heartbeat sent");
  } catch (e) {
    console.error("Heartbeat error:", e.message);
  }
}, 60 * 60 * 1000);

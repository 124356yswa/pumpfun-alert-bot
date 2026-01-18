import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

/* ===== CONFIG (ENV) ===== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WALLET = new PublicKey(process.env.WALLET);
const RPC_URL = process.env.RPC_URL;

/* ===== INIT ===== */
const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
const seen = new Set();
let lastErrorSent = 0;

/* ===== ERROR ALERT ===== */
async function sendError(text) {
  const now = Date.now();
  if (now - lastErrorSent < 60_000) return; // анти-спам 1 хв
  lastErrorSent = now;

  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `🚨 BOT ERROR\n\n${text}`
    );
  } catch (e) {
    console.error("Failed to send error:", e.message);
  }
}

/* ===== ONLINE MESSAGE ===== */
setTimeout(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `⚡ BOT ONLINE\n👛 Wallet:\n${WALLET.toBase58()}`
    );
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
}, 3000);

/* ===== /status ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptimeMs = Date.now() - startTime;
  const h = Math.floor(uptimeMs / 3600000);
  const m = Math.floor((uptimeMs % 3600000) / 60000);

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 BOT STATUS\n\n✅ Online: YES\n⏱ Uptime: ${h}h ${m}m\n\n👛 Wallet:\n${WALLET.toBase58()}`
  );
});

/* ===== WATCH WALLET ===== */
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

          await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `🚀 NEW TOKEN CREATED\n\n🪙 Mint: ${mint}\n\n🔥 Pump.fun:\nhttps://pump.fun/${mint}\n\n🔎 Solscan:\nhttps://solscan.io/token/${mint}`
          );
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);
    await sendError(`Watcher error:\n${e.message}`);
  }
}, 15000);

/* ===== HEARTBEAT ===== */
setInterval(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "💓 Бот живий і працює"
    );
  } catch (e) {
    console.error("Heartbeat error:", e.message);
  }
}, 60 * 60 * 1000);

/* ===== GLOBAL CRASH HANDLERS ===== */
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await sendError(`Uncaught Exception:\n${err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled Rejection:", reason);
  await sendError(`Unhandled Rejection:\n${reason}`);
});
bot.on("message", (msg) => {
  console.log("MSG FROM:", msg.chat.id, msg.text);
});

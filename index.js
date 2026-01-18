import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

/* ================= CONFIG ================= */

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const WALLET = new PublicKey(process.env.WALLET);
const RPC_URL = process.env.RPC_URL;

/* ================= UTILS ================= */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================= INIT ================= */

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || !RPC_URL || !process.env.WALLET) {
  console.error("❌ ENV ERROR: Missing env variables");
  process.exit(1);
}

const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ================= STATE ================= */

const startTime = Date.now();
const seen = new Set();
let onlineSent = false;

/* ================= /status ================= */

bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptime = Date.now() - startTime;
  const minutes = Math.floor(uptime / 60000);
  const hours = Math.floor(minutes / 60);

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 BOT STATUS\n\n` +
      `✅ Online: YES\n` +
      `⏱ Uptime: ${hours}h ${minutes % 60}m\n\n` +
      `👛 Wallet:\n${WALLET.toBase58()}`
  );
});

/* ================= ONLINE MESSAGE ================= */

setTimeout(async () => {
  if (onlineSent) return;
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `⚡ BOT ONLINE\n👛 Wallet:\n${WALLET.toBase58()}`
    );
    onlineSent = true;
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
}, 3000);

/* ================= WATCHER ================= */

setInterval(async () => {
  try {
    const sigs = await connection.getSignaturesForAddress(WALLET, {
      limit: 2,
    });

    for (const s of sigs) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);

      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });

      await sleep(1200);

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
            `🚀 NEW TOKEN CREATED\n\n` +
              `🪙 Mint:\n${mint}\n\n` +
              `🔥 Pump.fun:\nhttps://pump.fun/${mint}\n\n` +
              `🔎 Solscan:\nhttps://solscan.io/token/${mint}`
          );

          console.log("NEW TOKEN:", mint);
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);

    try {
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        `🚨 BOT ERROR\n\n${e.message}`
      );
    } catch {}
  }
}, 60 * 1000); // ⬅️ 1 раз на хвилину

/* ================= HEARTBEAT ================= */

setInterval(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "💓 Бот живий і слідкує за гаманцем"
    );
  } catch {}
}, 60 * 60 * 1000); // 1 година
// ===== TEST ALERT (TEMPORARY) =====
setTimeout(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "🧪 TEST ALERT: бот працює і може надсилати повідомлення"
    );
    console.log("Test alert sent");
  } catch (e) {
    console.error("Test alert error:", e.message);
  }
}, 10000);

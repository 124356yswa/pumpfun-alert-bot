import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

/* ===== ENV ===== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const RPC_URL = process.env.RPC_URL;
const WALLET_ADDRESS = process.env.WALLET;

/* ===== CHECK ENV ===== */
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || !RPC_URL || !WALLET_ADDRESS) {
  console.error("❌ ENV variables missing");
  process.exit(1);
}

/* ===== INIT ===== */
const WALLET = new PublicKey(WALLET_ADDRESS);
const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
const seen = new Set();
let onlineSent = false;

/* ===== ONLINE MESSAGE (ONCE) ===== */
setTimeout(async () => {
  if (onlineSent) return;
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      `🟢 *BOT ONLINE*\n\n` +
      `👛 *Wallet:*\n\`${WALLET.toBase58()}\`\n\n` +
      `🛰 RPC connected\n` +
      `⏱ Monitoring started`,
      { parse_mode: "Markdown" }
    );
    onlineSent = true;
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
}, 3000);

/* ===== /status ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptimeMs = Date.now() - startTime;
  const minutes = Math.floor(uptimeMs / 60000);
  const hours = Math.floor(minutes / 60);

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 *BOT STATUS*\n\n` +
    `✅ Online: *YES*\n` +
    `⏱ Uptime: *${hours}h ${minutes % 60}m*\n\n` +
    `👛 Wallet:\n\`${WALLET.toBase58()}\``,
    { parse_mode: "Markdown" }
  );
});

/* ===== WATCH WALLET ===== */
setInterval(async () => {
  try {
    const sigs = await connection.getSignaturesForAddress(WALLET, { limit: 5 });

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

          const message =
            `🚀 *NEW TOKEN DETECTED*\n\n` +
            `🪙 *Mint Address*\n\`${mint}\`\n\n` +
            `🔥 *Pump.fun*\n` +
            `https://pump.fun/${mint}\n\n` +
            `🔎 *Solscan*\n` +
            `https://solscan.io/token/${mint}\n\n` +
            `⚡ *Detected instantly*`;

          await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
            parse_mode: "Markdown",
            disable_web_page_preview: false,
          });

          console.log("NEW TOKEN:", mint);
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);

    // error alert (НЕ спамить)
    if (!e.message.includes("429")) {
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        `🚨 *BOT ERROR*\n\n\`${e.message}\``,
        { parse_mode: "Markdown" }
      );
    }
  }
}, 15000);

/* ===== HEARTBEAT (1h) ===== */
setInterval(async () => {
  try {
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      "💓 *Bot alive*\nStill monitoring wallet",
      { parse_mode: "Markdown" }
    );
  } catch {}
}, 60 * 60 * 1000);

import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

ENV CHECK: {
  TELEGRAM_TOKEN: true,
  TELEGRAM_CHAT_ID: '1358730050',
  WALLET: '6DtEedWf9Wk5hA7Xth82Eq441yf5DA4aGLqaQAVfDokm',
  RPC_URL: 'https://...'
}

/* ===== INIT ===== */
const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
let onlineSent = false;
const seen = new Set();

/* ===== /status COMMAND ===== */
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptimeMs = Date.now() - startTime;
  const minutes = Math.floor(uptimeMs / 60000);
  const hours = Math.floor(minutes / 60);

  const text =
    `📊 BOT STATUS\n\n` +
    `✅ Online: YES\n` +
    `⏱ Uptime: ${hours}h ${minutes % 60}m\n\n` +
    `👛 Wallet:\n${WALLET.toBase58()}`;

  await bot.sendMessage(chatId, text);
});

/* ===== ONLINE MESSAGE (ONCE) ===== */
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

          const msg =
            `🚀 NEW TOKEN CREATED\n\n` +
            `🪙 Mint: ${mint}\n\n` +
            `🔥 Pump.fun:\nhttps://pump.fun/${mint}\n\n` +
            `🔎 Solscan:\nhttps://solscan.io/token/${mint}`;

          await bot.sendMessage(TELEGRAM_CHAT_ID, msg);
          console.log("NEW TOKEN:", mint);
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);
  }
}, 15000);

/* ===== HEARTBEAT (1 HOUR) ===== */
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

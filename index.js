import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";
import fetch from "node-fetch";

/* ===== ENV ===== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const RPC_URL = process.env.RPC_URL;
const WALLET = new PublicKey(process.env.WALLET);

/* ===== INIT ===== */
const connection = new Connection(RPC_URL, "confirmed");
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ===== STATE ===== */
const seenTx = new Set();
const prePumpMints = new Set();

/* ===== HELPERS ===== */
async function pumpPageExists(mint) {
  try {
    const res = await fetch(`https://pump.fun/${mint}`, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function sendError(error) {
  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `🚨 <b>BOT ERROR</b>\n\n<code>${error}</code>`,
    { parse_mode: "HTML" }
  );
}

/* ===== ONLINE MESSAGE ===== */
setTimeout(() => {
  bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `✅ <b>BOT ONLINE</b>\n\n👛 Wallet:\n<code>${WALLET.toBase58()}</code>`,
    { parse_mode: "HTML" }
  );
}, 2000);

/* ===== WATCHER ===== */
setInterval(async () => {
  try {
    const sigs = await connection.getSignaturesForAddress(WALLET, { limit: 5 });

    for (const s of sigs) {
      if (seenTx.has(s.signature)) continue;
      seenTx.add(s.signature);

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

          // ===== PRE-PUMP =====
          const exists = await pumpPageExists(mint);
          if (!exists) {
            prePumpMints.add(mint);

            await bot.sendMessage(
              TELEGRAM_CHAT_ID,
              `🟡 <b>PRE-PUMP DETECTED</b>\n\n` +
                `🪙 Mint:\n<code>${mint}</code>\n\n` +
                `⚠️ Pump.fun ще НЕ активний\n` +
                `🔎 <a href="https://solscan.io/token/${mint}">Solscan</a>`,
              { parse_mode: "HTML", disable_web_page_preview: true }
            );
          }
        }
      }
    }
  } catch (e) {
    await sendError(e.message);
  }
}, 15000);

/* ===== CHECK LIVE ON PUMP ===== */
setInterval(async () => {
  for (const mint of [...prePumpMints]) {
    const live = await pumpPageExists(mint);
    if (live) {
      prePumpMints.delete(mint);

      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        `🚀 <b>LIVE ON PUMP.FUN</b>\n\n` +
          `🪙 Mint:\n<code>${mint}</code>\n\n` +
          `🔥 <a href="https://pump.fun/${mint}">Open pump.fun</a>\n` +
          `🔎 <a href="https://solscan.io/token/${mint}">Solscan</a>`,
        { parse_mode: "HTML", disable_web_page_preview: true }
      );
    }
  }
}, 10000);

/* ===== /status ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 <b>BOT STATUS</b>\n\n` +
      `✅ Online\n` +
      `👛 Wallet:\n<code>${WALLET.toBase58()}</code>`,
    { parse_mode: "HTML" }
  );
});

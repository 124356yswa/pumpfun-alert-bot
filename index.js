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
  console.error("❌ Missing ENV variables");
  process.exit(1);
}

/* ===== INIT ===== */
const connection = new Connection(RPC_URL, "confirmed");
const walletPubkey = new PublicKey(WALLET);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("BOT STARTING");
console.log("Watching wallet:", walletPubkey.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
const seen = new Set();
let onlineSent = false;

/* ===== SAFE SEND ===== */
async function send(chatId, text) {
  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
}

/* ===== ONLINE MESSAGE ===== */
setTimeout(() => {
  if (onlineSent) return;

  send(
    TELEGRAM_CHAT_ID,
    `✅ <b>PUMPFUN WATCHER ONLINE</b>\n\n` +
      `👛 <b>Tracking wallet:</b>\n<code>${walletPubkey.toBase58()}</code>\n\n` +
      `🔔 <b>Alerts:</b>\n• Token launches\n• Errors only`
  );

  onlineSent = true;
}, 3000);

/* ===== STATUS COMMAND ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptime = Math.floor((Date.now() - startTime) / 60000);

  send(
    TELEGRAM_CHAT_ID,
    `📊 <b>BOT STATUS</b>\n\n` +
      `✅ Online: YES\n` +
      `⏱ Uptime: ${uptime} min\n\n` +
      `👛 Wallet:\n<code>${walletPubkey.toBase58()}</code>`
  );
});

let rpcBlocked = false;

setInterval(async () => {
  if (rpcBlocked) return;

  try {
    const sigs = await connection.getSignaturesForAddress(walletPubkey, {
      limit: 3, // ⬅️ МЕНШЕ
    });

    for (const s of sigs) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);

      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) continue;

      const instructions =
        tx.transaction.message.instructions || [];

      for (const ix of instructions) {
        if (
          ix.program === "spl-token" &&
          ix.parsed?.type === "initializeMint"
        ) {
          const mint = ix.parsed.info.mint;

          await send(
            TELEGRAM_CHAT_ID,
            `🚀 <b>NEW TOKEN ON PUMP.FUN</b>\n\n` +
              `🧬 <b>Mint:</b>\n<code>${mint}</code>\n\n` +
              `🔗 <b>Links:</b>\n` +
              `• <a href="https://pump.fun/${mint}">Pump.fun</a>\n` +
              `• <a href="https://solscan.io/token/${mint}">Solscan</a>`
          );
        }
      }
    }
  } catch (e) {
    if (e.message.includes("429")) {
      rpcBlocked = true;

      await send(
        TELEGRAM_CHAT_ID,
        `⚠️ <b>RPC RATE LIMIT</b>\n\n` +
          `⏳ RPC тимчасово обмежив запити.\n` +
          `🤖 Бот автоматично відновиться через 2 хвилини`
      );

      console.error("RPC 429 — cooldown");

      setTimeout(() => {
        rpcBlocked = false;
      }, 2 * 60 * 1000); // ⬅️ 2 хв пауза
    } else {
      await send(
        TELEGRAM_CHAT_ID,
        `🚨 <b>BOT ERROR</b>\n\n<code>${e.message}</code>`
      );
    }
  }
}, 30_000); // ⬅️ ТЕПЕР 30 СЕКУНД

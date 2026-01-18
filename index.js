import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";

/* ===== ENV ===== */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WALLET = new PublicKey(process.env.WALLET);
const RPC_URL = process.env.RPC_URL;
const PORT = process.env.PORT || 3000;

/* ===== INIT ===== */
const bot = new TelegramBot(TELEGRAM_TOKEN);
const connection = new Connection(RPC_URL, "confirmed");

const app = express();
app.use(express.json());

const WEBHOOK_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;

/* ===== WEBHOOK ===== */
await bot.setWebHook(`${WEBHOOK_URL}/bot${TELEGRAM_TOKEN}`);

app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (_, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

console.log("BOT STARTING");
console.log("Watching wallet:", WALLET.toBase58());

/* ===== STATE ===== */
const startTime = Date.now();
const seen = new Set();

/* ===== ONLINE MESSAGE ===== */
setTimeout(async () => {
  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `⚡ BOT ONLINE\n👛 Wallet:\n${WALLET.toBase58()}`
  );
}, 3000);

/* ===== /status ===== */
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID.toString()) return;

  const uptime = Date.now() - startTime;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);

  await bot.sendMessage(
    TELEGRAM_CHAT_ID,
    `📊 BOT STATUS\n\n✅ Online: YES\n⏱ Uptime: ${h}h ${m}m\n\n👛 Wallet:\n${WALLET.toBase58()}`
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

      for (const ix of tx.transaction.message.instructions || []) {
        if (ix.program === "spl-token" && ix.parsed?.type === "initializeMint") {
          const mint = ix.parsed.info.mint;

          await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `🚀 NEW TOKEN CREATED\n\n🪙 Mint: ${mint}\n\n🔥 Pump.fun:\nhttps://pump.fun/${mint}`
          );
        }
      }
    }
  } catch (e) {
    console.error("Watcher error:", e.message);
  }
}, 15000);

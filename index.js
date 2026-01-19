import TelegramBot from "node-telegram-bot-api";
import { Connection, PublicKey } from "@solana/web3.js";

// ===== ENV =====
const {
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID,
  RPC_URL,
  WALLET
} = process.env;

// ===== BOT =====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===== STATE =====
let lastError = null;
let lastErrorTime = null;
let lastRpcCheck = null;
let rpcStatus = "UNKNOWN";

// ===== SOLANA =====
const connection = new Connection(RPC_URL, {
  commitment: "confirmed"
});

const walletPubkey = new PublicKey(WALLET);

// ===== HELPERS =====
function now() {
  return new Date().toLocaleString("uk-UA");
}

async function sendErrorAlert(error) {
  const msg = `
🚨 *BOT ERROR*

❌ *RPC problem*
🕒 ${now()}

📄 *Message:*
\`${error.message}\`
  `;
  await bot.sendMessage(TELEGRAM_CHAT_ID, msg, { parse_mode: "Markdown" });
}

// ===== RPC HEALTH CHECK =====
async function checkRpc() {
  try {
    await connection.getLatestBlockhash();
    rpcStatus = "OK";
    lastRpcCheck = now();
  } catch (err) {
    rpcStatus = "ERROR";
    lastError = err.message;
    lastErrorTime = now();
    lastRpcCheck = now();
    await sendErrorAlert(err);
  }
}

// ===== WATCHER =====
async function startWatcher() {
  console.log("BOT STARTING");
  console.log("Watching wallet:", WALLET);

  // первинна перевірка
  await checkRpc();

  // регулярна перевірка RPC (раз в 30 сек)
  setInterval(checkRpc, 30_000);
}

startWatcher();

// ===== TELEGRAM COMMANDS =====
bot.onText(/\/status/, async (msg) => {
  if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID) return;

  const statusMsg = `
🤖 *BOT STATUS*

🟢 *Bot:* RUNNING
🌐 *RPC:* ${rpcStatus}
⏱ *Last RPC check:* ${lastRpcCheck ?? "—"}

👛 *Wallet:*
\`${WALLET}\`

🚨 *Last error:*
${lastError ? `\`${lastError}\`\n🕒 ${lastErrorTime}` : "None"}
  `;

  await bot.sendMessage(TELEGRAM_CHAT_ID, statusMsg, {
    parse_mode: "Markdown"
  });
});

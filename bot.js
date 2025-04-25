import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const TELEGRAM_TOKEN = '7741072999:AAH2kj4m_N6pXjuH3lNUO5SeggE1mf03HRk';
const ETHERSCAN_API_KEY = 'HCBYJC9Z4MV3J8GUKAGY45S4UFR5A3GJHT';
const BSCSCAN_API_KEY = 'UP67QXP1XY6PFZJN4HFDIK9MKB9WWNM14J';

const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';

const app = express();
app.use(express.json()); // important for webhook

const bot = new TelegramBot(TELEGRAM_TOKEN);
bot.setWebHook(`https://aaa-j862.onrender.com/${TELEGRAM_TOKEN}`);

// ===== Express Route for Webhook =====
app.post(`/${TELEGRAM_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== Health Check Route =====
app.get('/', (req, res) => res.send('Bot is running via webhook 🚀'));

// ===== Wallet Validation =====
const isValidAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

// ===== Format Tx =====
const formatUsdtTx = (tx, address) => {
  const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
  const direction = isOutgoing ? '🔴 ↑' : '🟢 ↓';
  const value = parseFloat(tx.value) / Math.pow(10, tx.tokenDecimal);
  const time = new Date(tx.timeStamp * 1000).toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return `${direction} ${value.toFixed(2)} USDT\n⏰ ${time}`;
};

// ===== ETH Functions =====
const getEthData = async (address) => {
  const [ethBal, usdtBal, txs] = await Promise.all([
    axios.get(`https://api.etherscan.io/api?module=account&action=balance&address=${address}&apikey=${ETHERSCAN_API_KEY}`),
    axios.get(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDT_ERC20}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`),
    axios.get(`https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${USDT_ERC20}&address=${address}&sort=desc&apikey=${ETHERSCAN_API_KEY}`)
  ]);

  return {
    eth: parseFloat(ethBal.data.result) / 1e18,
    usdt: parseFloat(usdtBal.data.result) / 1e6,
    txs: txs.data.result
  };
};

// ===== BSC Functions =====
const getBscData = async (address) => {
  const [bnbBal, usdtBal, txs] = await Promise.all([
    axios.get(`https://api.bscscan.com/api?module=account&action=balance&address=${address}&apikey=${BSCSCAN_API_KEY}`),
    axios.get(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${USDT_BEP20}&address=${address}&tag=latest&apikey=${BSCSCAN_API_KEY}`),
    axios.get(`https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_BEP20}&address=${address}&sort=desc&apikey=${BSCSCAN_API_KEY}`)
  ]);

  return {
    bnb: parseFloat(bnbBal.data.result) / 1e18,
    usdt: parseFloat(usdtBal.data.result) / 1e18,
    txs: txs.data.result
  };
};

// ===== Bot Message Handler =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const address = msg.text.trim();

  if (!isValidAddress(address)) {
    return bot.sendMessage(chatId, '⚠️ Invalid wallet address. Please provide a valid ETH/BSC address (starts with 0x).');
  }

  try {
    bot.sendMessage(chatId, '⏳ Fetching wallet data... Please wait.');

    const [eth, bsc] = await Promise.all([
      getEthData(address),
      getBscData(address)
    ]);

    const combinedTxs = [...eth.txs, ...bsc.txs].sort((a, b) => b.timeStamp - a.timeStamp);
    const last5 = combinedTxs.slice(0, 5).map(tx => formatUsdtTx(tx, address)).join('\n\n');

    const response = `
🔔 *Wallet Update*
💼 \`${address}\`

🟣 ETH: ${eth.eth.toFixed(4)}  
💵 USDT (ERC20): ${eth.usdt.toFixed(2)}  
🟡 BNB: ${bsc.bnb.toFixed(4)}  
💵 USDT (BEP20): ${bsc.usdt.toFixed(2)}  

✨ *Last 5 USDT Transactions:*

${last5 || 'No recent USDT activity.'}

_Bot by Ronaldo_
    `.trim();

    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Error:', err.message);
    bot.sendMessage(chatId, '❌ Error fetching wallet info. Please try again later.');
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));

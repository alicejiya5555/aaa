import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import express from 'express';

const TELEGRAM_TOKEN = '7741072999:AAH2kj4m_N6pXjuH3lNUO5SeggE1mf03HRk';
const ETHERSCAN_API = 'HCBYJC9Z4MV3J8GUKAGY45S4UFR5A3GJHT';
const BSCSCAN_API = 'UP67QXP1XY6PFZJN4HFDIK9MKB9WWNM14J';
const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));

const isValidAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

function formatUsdtTx(tx, address) {
  const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
  const direction = isOutgoing ? '🔴 ↓' : '🟢 ↑';
  const value = parseFloat(tx.value) / Math.pow(10, tx.tokenDecimal);
  const time = new Date(tx.timeStamp * 1000).toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  return `${direction} ${value.toFixed(2)} USDT\n⏰ ${time}`;
}

async function getEthData(address) {
  const [ethBalanceRes, usdtBalanceRes, txRes] = await Promise.all([
    axios.get(`https://api.etherscan.io/api?module=account&action=balance&address=${address}&apikey=${ETHERSCAN_API}`),
    axios.get(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDT_ERC20}&address=${address}&tag=latest&apikey=${ETHERSCAN_API}`),
    axios.get(`https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${USDT_ERC20}&address=${address}&sort=desc&apikey=${ETHERSCAN_API}`)
  ]);

  return {
    eth: parseFloat(ethBalanceRes.data.result) / 1e18,
    usdt: parseFloat(usdtBalanceRes.data.result) / 1e6,
    txs: txRes.data.result
  };
}

async function getBscData(address) {
  const [bnbBalanceRes, usdtBalanceRes, txRes] = await Promise.all([
    axios.get(`https://api.bscscan.com/api?module=account&action=balance&address=${address}&apikey=${BSCSCAN_API}`),
    axios.get(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${USDT_BEP20}&address=${address}&tag=latest&apikey=${BSCSCAN_API}`),
    axios.get(`https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_BEP20}&address=${address}&sort=desc&apikey=${BSCSCAN_API}`)
  ]);

  return {
    bnb: parseFloat(bnbBalanceRes.data.result) / 1e18,
    usdt: parseFloat(usdtBalanceRes.data.result) / 1e18,
    txs: txRes.data.result
  };
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const address = msg.text?.trim();

  if (!address || !address.startsWith('0x')) {
    return bot.sendMessage(chatId, '⚠️ This is a wrong address. Please paste a correct wallet address (starts with 0x).');
  }

  if (!isValidAddress(address)) {
    return bot.sendMessage(chatId, '⚠️ Invalid address format. Ethereum/BSC addresses must be 42 characters long and start with 0x.');
  }

  bot.sendMessage(chatId, '⏳ Processing your request... Please wait.');

  try {
    const [eth, bsc] = await Promise.all([
      getEthData(address),
      getBscData(address)
    ]);

    const combinedTxs = [...eth.txs, ...bsc.txs].sort((a, b) => b.timeStamp - a.timeStamp);
    const last5 = combinedTxs.slice(0, 5).map(tx => formatUsdtTx(tx, address)).join('\n\n');

    const reply = `
🔔 *Wallet Update*
💼 \`${address}\`

🟣 ETH: ${eth.eth.toFixed(4)} ETH  
💵 USDT (ERC20): ${eth.usdt.toFixed(2)} USDT  
🟡 BNB: ${bsc.bnb.toFixed(4)} BNB  
💵 USDT (BEP20): ${bsc.usdt.toFixed(2)} USDT  

✨ *Last 5 USDT Transactions:*  
${last5 || 'No recent USDT activity.'}

_Bot by Ronaldo_
    `.trim();

    bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Error fetching wallet data:', err.message);
    bot.sendMessage(chatId, '❌ Error fetching data. Please try again later.');
  }
});

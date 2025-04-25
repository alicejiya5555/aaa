
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import express from 'express';

// === Your credentials ===
const TELEGRAM_TOKEN = '7655482876:AAEnwJeJQA4B0eYwnSEhrCJsbmuERlSoOtE';
const ETHERSCAN_API = 'HCBYJC9Z4MV3J8GUKAGY45S4UFR5A3GJHT';
const BSCSCAN_API = 'UP67QXP1XY6PFZJN4HFDIK9MKB9WWNM14J';
const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';

// === Initialize bot & server ===
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));

// === Utility function to validate wallet address ===
const isValidAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

// === Message handler ===
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userInput = msg.text;

  if (!userInput || !userInput.startsWith('0x')) {
    return bot.sendMessage(chatId, '⚠️ This is a wrong address. Please paste a correct wallet address (starts with 0x).');
  }

  if (!isValidAddress(userInput)) {
    return bot.sendMessage(chatId, '⚠️ This is a wrong address. Make sure it is a valid Ethereum/BSC wallet (starts with 0x and 42 characters long).');
  }

  bot.sendMessage(chatId, '⏳ We are working on it... Please wait for the result.');

  try {
    const [eth, erc20, bnb, bep20, tx] = await Promise.all([
      axios.get(`https://api.etherscan.io/api?module=account&action=balance&address=${userInput}&tag=latest&apikey=${ETHERSCAN_API}`),
      axios.get(`https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${USDT_ERC20}&address=${userInput}&tag=latest&apikey=${ETHERSCAN_API}`),
      axios.get(`https://api.bscscan.com/api?module=account&action=balance&address=${userInput}&apikey=${BSCSCAN_API}`),
      axios.get(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${USDT_BEP20}&address=${userInput}&tag=latest&apikey=${BSCSCAN_API}`),
      axios.get(`https://api.etherscan.io/api?module=account&action=txlist&address=${userInput}&sort=desc&apikey=${ETHERSCAN_API}`)
    ]);

    const ethBal = (parseFloat(eth.data.result) / 1e18).toFixed(4);
    const erc20Bal = (parseFloat(erc20.data.result) / 1e6).toFixed(2);
    const bnbBal = (parseFloat(bnb.data.result) / 1e18).toFixed(4);
    const bep20Bal = (parseFloat(bep20.data.result) / 1e18).toFixed(2);

    const lastTx = tx.data.result[0];
    const lastTxHash = lastTx?.hash || 'No transactions found';
    const lastTxDate = lastTx?.timeStamp
      ? new Date(lastTx.timeStamp * 1000).toUTCString()
      : 'N/A';

    const reply = `🔔 Wallet Update

💼 Address: ${userInput}

🟣 ETH: ${ethBal}
💵 USDT (ERC20): ${erc20Bal}
🟡 BNB: ${bnbBal}
💵 USDT (BEP20): ${bep20Bal}

🔁 New ETH Tx Detected:
🆔 ${lastTxHash}
📅 ${lastTxDate}

Bot Created by Ronaldo ( Thanks for using the Bot )`;

    bot.sendMessage(chatId, reply);
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '⚠️ Error fetching data. Please try again later.');
  }
});

const TOKEN = '';
const url = 'https://cloudcompcourse.cfapps.eu10.hana.ondemand.com';
const port = 8080;

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const bot = new TelegramBot(TOKEN);

bot.setWebHook(`${url}/bot${TOKEN}`);

const app = express();

app.use(express.json());

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Express server is listening on ${port}`);
});

bot.on('message', msg => {
  bot.sendMessage(msg.chat.id, 'I am alive!');
});


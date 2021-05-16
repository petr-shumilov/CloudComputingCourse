const config            = require('./config/testenv.json');
const User              = require('./lib/User');
const DB                = require('./lib/DB');
const Storage           = require('./lib/Storage');
const TelegramUtils     = require('./lib/TelegramUtils');
const Utils             = require('./lib/Utils');


const STATE             = require('./State');
const COMMAND           = require('./Command');

const TelegramBot       = require('node-telegram-bot-api');
const express           = require('express');
const axios             = require('axios');



function BotSetup() {
    if (config.telegram.polling === true) {
        return new TelegramBot(config.telegram.token, {
            polling: true
        });
    } else {
        const bot = new TelegramBot(config.telegram.token);

        bot.setWebHook(`${config.telegram.webhook.url}/bot${config.telegram.token}`);

        const expressApp = express();
        expressApp.use(express.json());

        expressApp.post(`/bot${config.telegram.token}`, (req, res) => {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });

        expressApp.listen(config.telegram.webhook.port, () => {
            console.log(`[expressApp]: Express server is listening on ${config.telegram.webhook.port}`);
        });

        return bot;
    }
}

const Bot = BotSetup();


async function GetAIServiceRequest(url, endpoint, data) {
    let query = '';
    for (const key in data) {
        if (query !== "") {
            query += "&";
        }
        query += `${key}=${encodeURIComponent(data[key])}`;
    }
    return (await axios.get(`${url}/${endpoint}?${query}`)).data;
}

const SKILLS = {
    CHECK_YOUR_JOB: {
        STATE: {
            string: "CHECK_YOUR_JOB"
        },
        COMMAND: {
            regexp: /\/check/
        },
        fields: {
            age: {
                question: "How old are you?",
                isValid: (text) => {
                    return !isNaN(parseFloat(text)) && !isNaN(text - 0);
                }
            },
            position: {
                question: "What is your current position?",
                isValid: (text) => {
                    return true;
                }
            }
        }
    }
};

Bot.on('message', async msg => {

    const chatId = msg.chat.id;
    let user = new User({ chatId });
    let userId;
    const storage = new Storage(DB);

    try {

        if (await user.CheckExist() === false) {
            await user.SetState(STATE.IDLE.string).Create();
        }
        userId = user.GetId();


        switch (await user.GetState()) {
            case STATE.IDLE.string:
                try {
                    if (TelegramUtils.isTextMessage(msg) === false) {
                        Bot.sendMessage(chatId, "Sorry, but I understand only text (=");
                        break;
                    }

                    switch (true) {
                        case COMMAND.START.regexp.test(msg.text) :
                            Bot.sendMessage(chatId, "Hi, I'm bot Sergei and I wanna help you to decide it's the time to change your job. Type\n/check - for short interview about your job");
                            break;

                        case COMMAND.HELP.regexp.test(msg.text):
                            Bot.sendMessage(chatId, "I'm pretty easy to use). First of all, type /start");
                            break;

                        case SKILLS.CHECK_YOUR_JOB.COMMAND.regexp.test(msg.text):

                            let memory = await storage.GetMemoryByUserId(userId);

                            if (Object.keys(memory).length === Object.keys(SKILLS.CHECK_YOUR_JOB.fields).length) {

                                await user.SetState(STATE.PENDING.string).PushUpdates();
                                await storage.MultipleInsertInMemoryByUserId(userId, {});
                                await Bot.sendMessage(chatId, "I'm thinking...");

                                const res = await GetAIServiceRequest(config.services.ai.url, '/predict', {
                                    age: memory.age
                                });

                                await user.SetState(STATE.IDLE.string).PushUpdates();

                                Bot.sendMessage(chatId, `From my artificial experience, people who occur in a situation like you changes a job in ${res.payload['yes']} cases and stay in ${res.payload['no']} cases.\n\nTry again? Just /start`);

                            } else {

                                let nextProcessingFieldName;
                                for (let f in SKILLS.CHECK_YOUR_JOB.fields) {
                                    if (memory[f] === undefined) {
                                        Bot.sendMessage(chatId, SKILLS.CHECK_YOUR_JOB.fields[f].question);
                                        nextProcessingFieldName = f;
                                        break
                                    }
                                }

                                await storage.SetSkillProcessingFieldByUserId(userId, nextProcessingFieldName)
                                await user.SetState(SKILLS.CHECK_YOUR_JOB.STATE.string).PushUpdates();
                            }

                            break;
                        default:
                            Bot.sendMessage(chatId, "Sorry, but I don't understand you, maybe it gets /help");
                            break;
                    }
                }
                catch (e) {
                    await user.SetState(STATE.IDLE.string).PushUpdates();

                    console.log(`[Telegram][IDLE]: \n${e.message}\n${e.stack}\n\n`);
                    if (e instanceof Error) {
                        throw new Error(`[Telegram][IDLE]: error \n${e.message}\n${e.stack}\n\n`);
                    }
                }
                break;

            case SKILLS.CHECK_YOUR_JOB.STATE.string:
                try {
                    if (TelegramUtils.isTextMessage(msg) === false) {
                        Bot.sendMessage(chatId, "Sorry, but I understand only text (=");
                        break;
                    }

                    if (Utils.isCommand(msg.text)) {
                        switch (true) {
                            case COMMAND.START.regexp.test(msg.text):
                                await user.SetState(STATE.IDLE.string).PushUpdates();
                                Bot.sendMessage(chatId, "Hi, it's me again) Is it time to change job? Let's check. Type\n/check - for short interview about your job");
                                break;
                            case COMMAND.HELP.regexp.test(msg.text):
                                Bot.sendMessage(chatId, "I'm pretty easy to use). You can answer the question or try something new via /start");
                                break;
                        }
                        break;
                    }

                    let processingFieldName = await storage.GetSkillProcessingFieldByUserId(userId);

                    if (!processingFieldName) {
                        throw new Error(`[Telegram][${SKILLS.CHECK_YOUR_JOB.STATE.string}]: empty \n\n`);
                    }

                    if (!SKILLS.CHECK_YOUR_JOB.fields[processingFieldName].isValid(msg.text)) {
                        Bot.sendMessage(chatId, "Probably, you didn't understand the question. Let's try again)");
                        break;
                    }

                    let memory = await storage.GetMemoryByUserId(userId);
                    memory[processingFieldName] = msg.text;
                    await storage.MultipleInsertInMemoryByUserId(userId, memory)

                    if (Object.keys(memory).length === Object.keys(SKILLS.CHECK_YOUR_JOB.fields).length) {

                        await user.SetState(STATE.PENDING.string).PushUpdates();
                        await storage.MultipleInsertInMemoryByUserId(userId, {});
                        await Bot.sendMessage(chatId, "I'm thinking...");

                        const res = await GetAIServiceRequest(config.services.ai.url, '/predict', {
                           age: memory.age
                        });

                        await user.SetState(STATE.IDLE.string).PushUpdates();

                        Bot.sendMessage(chatId, `From my artificial experience, people who occur in a situation like you changes a job in ${res.payload['yes']} cases and stay in ${res.payload['no']} cases.\n\nTry again? Just /start`);
                    } else {

                        let nextProcessingFieldName;
                        for (let f in SKILLS.CHECK_YOUR_JOB.fields) {
                            if (memory[f] === undefined) {
                                Bot.sendMessage(chatId, SKILLS.CHECK_YOUR_JOB.fields[f].question);
                                nextProcessingFieldName = f;
                                break
                            }
                        }

                        await storage.SetSkillProcessingFieldByUserId(userId, nextProcessingFieldName);
                    }

                } catch (e) {
                    await (user.SetState(STATE.IDLE.string).PushUpdates());

                    console.log(`[Telegram][${SKILLS.CHECK_YOUR_JOB.STATE.string}]: \n${e.message}\n${e.stack}\n\n`);
                    if (e instanceof Error) {
                        throw new Error(`[Telegram][${SKILLS.CHECK_YOUR_JOB.STATE.string}]: error \n${e.message}\n${e.stack}\n\n`);
                    }
                }

                break;

            case STATE.PENDING.string:
                try {
                    if (TelegramUtils.isTextMessage(msg) === false) {
                        await Bot.sendMessage(chatId, "Sorry, but I understand only text (=");
                        break;
                    }
                    await Bot.sendMessage(chatId, "I'm still thinking...");
                }
                catch (e) {
                    await user.SetState(STATE.IDLE.string).PushUpdates();

                    console.log(`[Telegram][IDLE]: \n${e.message}\n${e.stack}\n\n`);
                    if (e instanceof Error) {
                        throw new Error(`[Telegram][IDLE]: error \n${e.message}\n${e.stack}\n\n`);
                    }
                }
                break;
        }
    } catch (e) {
        if (e instanceof Error) {
            Bot.sendMessage(chatId, `Oops, something wrong. Please, contact with administrator\n${e.message}`);
            console.log(`[Telegram]: ${e.message}\n${e.stack}\n\n`);
        }
    }
});

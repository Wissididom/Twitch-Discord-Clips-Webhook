import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let cron = null;

rl.question('Please enter the cron expression you want to have it run as:', cronExpression => {
    cron = cronExpression;
    rl.close();
});

const configObject = {
    twitchLogin: process.env.BROADCASTER_LOGIN,
    cron: cron,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    pollingInterval: process.env.POLLING_INTERVAL,
    suppressUntitled: process.env.SUPPRESS_UNTITLED.toLowerCase() == "true",
    showCreatedDate: process.env.SHOW_CREATED_DATE.toLowerCase() == "true",
};

const config = JSON.parse(fs.readFileSync(".config.json"));

config.push(configObject);

fs.writeFileSync(".config.json", JSON.stringify(configObject, null, 2));

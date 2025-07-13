import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";

function readConfigIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  } else {
    return [];
  }
}

function runMigration(cron) {
  const configObject = {
    twitchLogin: process.env.BROADCASTER_LOGIN,
    cron: cron,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    pollingInterval: process.env.POLLING_INTERVAL,
    suppressUntitled: process.env.SUPPRESS_UNTITLED.toLowerCase() == "true",
    showCreatedDate: process.env.SHOW_CREATED_DATE.toLowerCase() == "true",
  };

  const config = readConfigIfExists(".config.json");

  config.push(configObject);

  fs.writeFileSync(".config.json", JSON.stringify(config, null, 2));
  console.log(JSON.stringify(config, null, 2));

  const newEnv = `TWITCH_CLIENT_ID=${process.env.TWITCH_CLIENT_ID ?? "[0-9a-z]"}\nTWITCH_CLIENT_SECRET=${process.env.TWITCH_CLIENT_SECRET ?? "[0-9a-z]"}`;

  fs.writeFileSync(".env", newEnv);
  console.log(newEnv);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Please enter the cron expression you want to have it run as:\n",
  (cron) => {
    rl.close();
    if (cron == "null") {
      runMigration(null);
    } else {
      runMigration(cron);
    }
  },
);

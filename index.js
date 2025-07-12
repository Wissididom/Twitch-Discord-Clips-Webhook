import fs from "node:fs";
import "dotenv/config";
import cron from "node-cron";
import { handleStreamer } from "./handleStreamer.js";

const config = JSON.parse(fs.readFileSync(".config.json"));

for (let streamer of config) {
  console.log(
    "Schedule job: " +
      JSON.stringify(streamer, (key, value) => {
        if (key == "discordWebhook") return "REDACTED";
        return value;
      }),
  );
  if (streamer.cron) {
    cron.schedule(
      streamer.cron,
      async () => {
        await handleStreamer(
          streamer.twitchLogin,
          streamer.discordWebhook,
          streamer.pollingInterval ?? "1d",
          streamer.suppressUntitled ?? false,
          streamer.showCreatedDate ?? true,
          false,
        );
      },
      {
        scheduled: true,
        timezone: streamer.timezone,
      },
    );
  } else {
    handleStreamer(
      streamer.twitchLogin,
      streamer.discordWebhook,
      streamer.pollingInterval ?? "1d",
      streamer.suppressUntitled ?? false,
      streamer.showCreatedDate ?? true,
      true,
    );
  }
}

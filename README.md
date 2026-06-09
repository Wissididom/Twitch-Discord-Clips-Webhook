# Twitch-Discord-Clips-Webhook

A Go application that monitors Twitch streamers for new clips and posts them to Discord via webhooks.

## Prerequisites

- Go 1.21 or later
- Twitch Client ID
- Twitch Client Secret
- Discord Webhook URL

## How to setup

### Step 1

Clone this repository

`git clone https://github.com/Wissididom/Twitch-Discord-Clips-Webhook`

### Step 2

Copy `example.env` into `.env` and adjust its values. Optionally you can also provide the options inside `example.env` as environment variables to the application.

### Step 3

Copy `config.example.json` to `.config.json` and modify it to your liking. You can specify multiple streamers.

### Step 4

Build the project

`go build -o twitch-discord-clips-webhook`

### Step 5

Run it with `./twitch-discord-clips-webhook`. The polling interval and the cron expression can be given in the `.config.json` file.

## Configuration

### `.env` file

Environment variables for Twitch API authentication:
- `TWITCH_CLIENT_ID`: Your Twitch application client ID
- `TWITCH_CLIENT_SECRET`: Your Twitch application client secret

### `.config.json` file

Array of streamer configurations:

```json
[
  {
    "twitchLogin": "streamer_username",
    "cron": "0 0 7 * * *",
    "timezone": "Europe/Berlin",
    "discordWebhook": "https://discord.com/api/webhooks/<webhookId>/<webhookToken>",
    "pollingInterval": "1d",
    "suppressUntitled": true,
    "showCreatedDate": false
  }
]
```

#### Configuration options:

- **twitchLogin** (required): The Twitch username to monitor
- **cron** (optional): Cron expression for scheduling. If not set, the script runs once with service polling
- **timezone** (optional): Timezone for cron jobs (e.g., "Europe/Berlin")
- **discordWebhook** (required): Discord webhook URL for posting clips
- **pollingInterval** (optional, default: "1d"): How far back to look for clips. Format: `{number}{unit}`
  - Units: `d` (days), `M` (months), `y` (years), `h` (hours), `m` (minutes), `s` (seconds)
- **suppressUntitled** (optional, default: false): Don't post clips with the same title as the VOD
- **showCreatedDate** (optional, default: true): Show the creation date in the Discord message

## Building

### Development

`go build -o twitch-discord-clips-webhook`

### Release Build

`go build -ldflags="-s -w" -o twitch-discord-clips-webhook`

For cross-platform builds:

```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o twitch-discord-clips-webhook

# Windows
GOOS=windows GOARCH=amd64 go build -o twitch-discord-clips-webhook.exe

# macOS
GOOS=darwin GOARCH=amd64 go build -o twitch-discord-clips-webhook
```


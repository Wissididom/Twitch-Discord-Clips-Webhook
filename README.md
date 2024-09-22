# Twitch-Discord-Clips-Webhook

## Prerequisites

- NodeJS
- Twitch Client ID
- Twitch Client Secret
- Discord Webhook URL

## How to setup

### Step 1

Clone this repository

`git clone https://github.com/Wissididom/Twitch-Discord-Clips-Webhook`

### Step 2

Copy `example.env` into `.env` and adjust it's values. Optionally you can also provide the options inside `example.env` with the correct values as environment variables to the application.

### Step 3

Copy `config.example.json` to `.config.json` and modify it to your liking, you can even specify multiple streamers.

### Step 4

Install dependencies

`npm i` or `npm install`

### Step 5

Run it with `node index.js`. The polling interval and the cron expression can be given in the `.config.json` file

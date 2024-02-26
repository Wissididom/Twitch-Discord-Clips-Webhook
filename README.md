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

Install dependencies

`npm i` or `npm install`

### Step 4

Run it with `node index.js` or specify it to run as a cronjob every 24h. The script ONLY checks once if there were clips made in the last 24h. It does NOT run itself every 24h.

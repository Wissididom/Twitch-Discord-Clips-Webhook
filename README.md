# Twitch-Discord-Clips-Webhook

## Prerequisites

NodeJS v18+ (because I use inbuild fetch without any fetch-library). It probably works if you install and import `node-fetch-commonjs` (`npm i node-fetch-commonjs` and `const fetch = require('node-fetch-commonjs');`) but I have not tested that and therefore it is not supported.

## How to setup

### Step 1

Clone this repository

`git clone https://github.com/Wissididom/Twitch-Discord-Clips-Webhook`

### Step 2

Copy `example.env` into `.env` and adjust it's values. Optionally you can also give the options inside `example.env` with the correct values as environment variables to the application.

### Step 3

Install dependencies

`npm i` or `npm install`

### Step 4

Run it with `node index.js` or specify it to run as a cronjob every 24h. The script ONLY checks once if there were clips made in the last 24h. It does NOT run itself every 24h.

# SellerSource Discord Bot — Setup Guide

## What this bot does

Type `/addcontact` in any Discord channel → fill in the fields → the bot logs the contact and syncs automatically to **Google Sheets** and/or **Notion** in real time.

---

## Step 1 — Create your Discord bot (10 min)

1. Go to **https://discord.com/developers/applications**
2. Click **New Application** → name it `SellerSource`
3. Go to **Bot** (left sidebar) → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy and save it (this is your `DISCORD_TOKEN`)
5. Scroll down to **Privileged Gateway Intents** → enable **Server Members Intent** and **Message Content Intent**
6. Go to **OAuth2 → URL Generator** (left sidebar)
   - Under Scopes: check `bot` and `applications.commands`
   - Under Bot Permissions: check `Send Messages`, `Use Slash Commands`, `Embed Links`
7. Copy the generated URL → paste it in your browser → select your server → click **Authorize**

**Where to find your IDs:**
- `CLIENT_ID` = the Application ID on the General Information page
- `GUILD_ID` = right-click your Discord server name → Copy Server ID (enable Developer Mode first: User Settings → Advanced → Developer Mode)

---

## Step 2 — Set up Google Sheets sync (5 min)

1. Open the Google Sheet you want to use (create a new one at sheets.google.com)
2. Go to **Extensions → Apps Script**
3. Delete all existing code
4. Paste everything from `google-apps-script.js` (included in this folder)
5. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** → copy the web app URL
7. Paste that URL as `APPS_SCRIPT_URL` in your `.env` file

---

## Step 3 — Set up Notion sync (optional, 10 min)

### Create the Notion database

1. In Notion, create a new **full-page database** (table view)
2. Add these exact properties with these exact types:

| Property name    | Type         |
|-----------------|--------------|
| Name            | Title        |
| Phone           | Phone        |
| Email           | Email        |
| State           | Text         |
| Contact Medium  | Select       |
| Notes           | Text         |
| Next Contact    | Date         |
| Date Added      | Date         |

3. For **Contact Medium**, add these select options: Phone, SMS, Email, Other

### Create the Notion integration

1. Go to **https://www.notion.so/my-integrations**
2. Click **New integration** → name it `SellerSource`
3. Copy the **Internal Integration Token** → paste as `NOTION_TOKEN` in `.env`
4. Go back to your database page in Notion
5. Click the `•••` menu (top right) → **Connections** → find your integration → click **Confirm**
6. Copy the database ID from the URL:
   - URL: `https://notion.so/YOUR_DATABASE_ID?v=...`
   - Copy the part before `?v=` → paste as `NOTION_DATABASE_ID` in `.env`

---

## Step 4 — Configure your .env file

Rename `.env.example` to `.env` and fill in all values:

```
DISCORD_TOKEN=paste_your_bot_token
CLIENT_ID=paste_your_application_id
GUILD_ID=paste_your_server_id
APPS_SCRIPT_URL=paste_your_apps_script_url
NOTION_TOKEN=paste_your_notion_token
NOTION_DATABASE_ID=paste_your_database_id
```

Google Sheets and Notion are both optional — the bot works with either one or both.

---

## Step 5 — Run the bot

### Option A: Run on your computer (free, needs to stay on)

```bash
npm install
node bot.js
```

You'll see:
```
✅ Bot online as: SellerSource#1234
📋 Sheets sync:  enabled
📝 Notion sync:  enabled
✅ /addcontact slash command registered
```

Keep this terminal window open. The bot stays online as long as your computer is on.

### Option B: Host for free on Railway.app (stays online 24/7)

1. Create a free account at **railway.app**
2. Click **New Project → Deploy from GitHub repo**
3. Push your bot folder to a GitHub repo first, then connect it
4. In Railway, go to **Variables** → add all your `.env` values one by one
5. Railway auto-detects `package.json` and runs `npm start`

Railway gives $5 free credit — a small bot uses roughly $1-3/month.

### Option C: Host for free on Render.com

1. Create account at **render.com**
2. New → **Background Worker** (not Web Service — bots don't need HTTP)
3. Connect your GitHub repo
4. Build command: `npm install`
5. Start command: `node bot.js`
6. Add environment variables in the Render dashboard
7. Deploy

---

## Using the bot

In any channel on your Discord server, type:

```
/addcontact
```

Discord will show you all the fields to fill in:

| Field          | Required | Notes                                      |
|---------------|----------|--------------------------------------------|
| name          | ✅ Yes   | Full name                                  |
| phone         | ✅ Yes   | 10 digits — auto-formatted                 |
| medium        | ✅ Yes   | Phone / SMS / Email / Other                |
| email         | No       |                                            |
| state         | No       | e.g. Texas                                 |
| medium_other  | No       | Fill if medium = Other (Facebook, etc.)    |
| notes         | No       | Summary of the call/contact                |
| next_contact  | No       | DD/MM/YYYY — auto-sets 2 business days     |

After submitting, the bot replies with a confirmation embed and sync status.

---

## Troubleshooting

| Problem                        | Fix                                                             |
|-------------------------------|-----------------------------------------------------------------|
| `/addcontact` not showing      | Wait 1 min after bot starts — commands take a moment to register|
| Sheets not syncing             | Check your Apps Script URL in `.env` — re-deploy if needed      |
| Notion giving 404              | Make sure you connected the integration to the database page    |
| Notion giving 400              | Property names in Notion must match exactly (case-sensitive)    |
| Bot offline                    | Restart `node bot.js` or check Railway/Render logs              |

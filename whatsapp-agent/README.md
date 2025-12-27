## WhatsApp Intake Agent

This project provides a lightweight dashboard for inspecting WhatsApp Cloud API conversations. It supports two ingestion paths:

- **On-demand history** – Pull messages directly from Meta's Graph API using your long-lived access token and phone number ID.
- **Live webhook capture** – Point your WhatsApp webhook subscription at `/api/webhook` to stream inbound events into the dashboard in real time.

> ⚠️ Store and handle access tokens securely. Leaving them in local storage or committing them to version control is unsafe.

## Local development

1. Copy the environment template:

   ```bash
   cp .env.local.example .env.local
   ```

   Adjust `WHATSAPP_VERIFY_TOKEN` to match the token configured inside Meta Business Manager.

2. Install dependencies and launch the dev server:

   ```bash
   npm install
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) to load the dashboard.

## WhatsApp configuration

1. Generate a long-lived access token and locate the phone number ID in Meta Business Manager.
2. Paste both values into the form at the top of the dashboard and click **Load messages** to query the Graph API.
3. Create a webhook subscription in Meta (Business Settings → WhatsApp → Webhooks) and point it to:

   ```
   https://YOUR_DEPLOYMENT_URL/api/webhook
   ```

   Make sure the verify token matches `WHATSAPP_VERIFY_TOKEN`.

4. Enable the message fields you want to receive (messages, statuses, etc.). Incoming payloads appear in the *Live webhook stream* panel.

## Production deployment

Deploy on Vercel with the following environment variables:

- `WHATSAPP_VERIFY_TOKEN`

After deploying, remember to set the webhook URL in Meta to the production domain (for example `https://agentic-e150a4bc.vercel.app/api/webhook`).

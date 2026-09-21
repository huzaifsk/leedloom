# Leadloom

A single-user job outreach workspace built with Next.js 16 and shadcn/ui.

## What it does

- Imports the supplied Jobhunter XLSX schema entirely in the browser.
- Validates email and WhatsApp contacts while preserving research rows.
- Stores leads, send status, sender details, and templates in local storage.
- Personalizes templates with `{{name}}`, `{{company}}`, `{{role}}`, `{{sender_name}}`, and `{{contact}}`.
- Sends reviewed email messages through an explicitly connected Gmail account.
- Opens one personalized WhatsApp conversation at a time and requires manual send confirmation.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Use `npm run build` for a verified production build. The project uses Next.js's webpack build path for compatibility with restricted CI and sandbox environments.

## Gmail integration

1. Create a Google Cloud project and enable the Gmail API.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Web application.
4. Add `http://localhost:3000/api/integrations/gmail/callback` as an authorized redirect URI.
5. Copy `.env.example` to `.env.local` and fill in the values.
6. Restart `npm run dev`, open Channels → Email, and choose **Connect Gmail**.

The app requests `openid`, `email`, `profile`, and `gmail.send`. Google tokens are encrypted into an HTTP-only, same-site cookie. The browser never receives the access or refresh token.

## Personal WhatsApp integration

Open Channels → WhatsApp and enter the name and E.164 phone number (for example `+919876543210`) of the personal account you will use. Leadloom opens a `wa.me` conversation containing the personalized message. The logged-in user must press Send, return to Leadloom, and explicitly confirm the send.

Personal assisted mode cannot verify delivery, reads, or replies. Those events require the WhatsApp Business Platform and are intentionally not fabricated by this app.

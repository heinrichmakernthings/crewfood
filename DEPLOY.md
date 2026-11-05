# Deploying Crew Table on Cloudflare

Crew Table is plain static files in `dist/`. There is no backend, database or secret. Plans are saved in each person's browser.

## 1. Connect the repo (about 3 minutes)
1. Cloudflare dashboard > **Workers & Pages** > **Create** > **Import a repository**, and pick this repo.
2. Project name `crew-table`. Build command: leave empty. Deploy command: `npx wrangler deploy`.
3. Save and deploy. Every push to `main` redeploys.

You get a `https://crew-table.<your-subdomain>.workers.dev` address.

## 2. Add a login (do this before sharing the link)
The app shows your costs, profit margin and wages, so keep it private.
1. Cloudflare **Zero Trust** > **Access** > **Applications** > **Add an application** > **Self-hosted**.
2. Point it at the `workers.dev` address (or your own domain).
3. Add a policy: **Allow**, **Emails** is your email and anyone on your team.
4. Test in a private browser window. It should ask for a one-time code by email.

Until this is on, anyone with the link can open the app and read the default prices and margins in it.

## 3. Day to day
- Open the app on any device. Plans are per browser, so use **Plan files > Download backup** to move a plan between devices.
- For clients, open **Reports > Client quote** and print to PDF. Clients never need the link.
- Before quoting, replace every ingredient marked "Estimate: check price" and the gas, electricity and equipment numbers on the Equipment tab.

## Local run and tests
```sh
npm run dev     # http://localhost:8000
npm test
```

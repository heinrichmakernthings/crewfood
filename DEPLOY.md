# Deploying Crew Table on Cloudflare (private repo, password protected)

Crew Table is static files in `dist/`, served by a small Worker (`src/worker.js`) that asks for a password first. There is no database or backend. Plans are saved in each person's browser.

## 1. Make the GitHub repo private
GitHub > this repo > **Settings** > **General** > **Danger Zone** > **Change visibility** > **Make private**.

## 2. Connect it to Cloudflare
1. Cloudflare dashboard > **Workers & Pages** > **Create** > **Import a repository**.
2. When asked, let the Cloudflare GitHub app see this repo (choose "Only select repositories" and tick it). This is what lets a private repo deploy.
3. Project name `crewfood` (it must match the `name` in wrangler.jsonc). Build command: leave empty. Deploy command: `npx wrangler deploy`.
4. Deploy. Every push to `main` redeploys.

## 3. Set the password (required)
The site refuses everyone until a password is set.
1. Workers & Pages > **crewfood** > **Settings** > **Variables and Secrets** > **Add**.
2. Type **Secret**, name `SITE_PASSWORD`, value your password. Use a long phrase, for example four random words. Save and deploy.
3. Optional: add another secret `SITE_USER` to also require a specific username. If you leave it out, any username works and only the password matters.
4. Open the site in a private window. Your browser shows a sign-in box. Enter the password.

Secrets stay put when you redeploy. To change the password, edit the secret and deploy.

Notes:
- Everyone shares one password. To cut someone off, change it and tell the others.
- Browsers remember the password until they are closed. There is no log out button.
- Nothing limits repeated guesses, so keep the password long. For named logins and an audit trail, use **Cloudflare Zero Trust > Access** instead: Add application > Self-hosted > Allow listed emails. It needs no code changes (delete `main` and `run_worker_first` from `wrangler.jsonc` if you move to Access).

## 4. Day to day
- Plans are per browser. Use **Plan files > Download backup** to move a plan between devices.
- For clients, open **Reports > Client quote** and print to PDF. Clients never need access to the app.
- Before quoting, replace every ingredient marked "Estimate: check price" and the gas, electricity and equipment numbers on the Equipment tab.

## Local run and tests
```sh
npm run dev     # http://localhost:8000 (no password locally)
npm test
```

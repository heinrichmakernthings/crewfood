# Deploying Crew Table on Cloudflare

Crew Table is static files in `dist/`. There is no database or backend. An optional password gate is in `src/worker.js`. Plans are saved in each person's browser.

## 1. Make the GitHub repo private
GitHub > this repo > **Settings** > **General** > **Danger Zone** > **Change visibility** > **Make private**.

## 2. Connect it to Cloudflare
1. Cloudflare dashboard > **Workers & Pages** > **Create** > **Import a repository**.
2. When asked, let the Cloudflare GitHub app see this repo (choose "Only select repositories" and tick it). This is what lets a private repo deploy.
3. Project name `crewfood` (it must match the `name` in wrangler.jsonc). Build command: leave empty. Deploy command: `npx wrangler deploy`.
4. Deploy. Every push to `main` redeploys.

## 3. Password: currently OFF
The test link is open: anyone with the address can use the app. It only holds sample prices and wages, and each person's plans stay in their own browser. Do not share the link beyond the team.

To turn the password on again:
1. In Cloudflare, Workers & Pages > **crewfood** > **Settings** > **Variables and Secrets**: add a Secret named `SITE_PASSWORD` with your password (a long phrase is best). Optional `SITE_USER` also requires a username.
2. Settings > **Builds** > change the deploy command to `npx wrangler deploy -c wrangler.password.jsonc`, then push any commit or retry the deployment.
3. Open the site in a private window. It should show a sign-in box.

Cloudflare Zero Trust > Access (allow listed emails) is the alternative if you want named logins.

## 4. Install it as an app
Crew Table is an installable web app. Once the site is open:
- **Android / Chrome / Edge on desktop:** use the **Install app** button in the top bar (or the install icon in the address bar).
- **iPhone / iPad (Safari):** Share, then **Add to Home Screen**.

It then opens in its own window with its own icon, and it works with no signal once it has loaded once. Plans still save on that device only.

When you release a change, bump `CACHE` in `dist/sw.js` (for example `crew-table-v2`) so installed copies refresh right away.

## 5. Day to day
- Plans are per browser. Use **Plan files > Download backup** to move a plan between devices.
- For clients, open **Reports > Client quote** and print to PDF. Clients never need access to the app.
- Before quoting, replace every ingredient marked "Estimate: check price" and the gas, electricity and equipment numbers on the Equipment tab.

## Local run and tests
```sh
npm run dev     # http://localhost:8000 (no password locally)
npm test
```

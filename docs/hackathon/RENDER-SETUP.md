# Full app on Render

This setup hosts the React interface and Spring backend together, with a separate managed PostgreSQL database. It uses the isolated `hackathon,render` profiles, sandbox PayPal only, and disabled AI calls initially. The private ChatGPT Sites menu preview remains a separate design preview.

**Current deployment (12 October 2026):** [TableKind full app](https://tablekind-hackathon.onrender.com/) is live on commit `b4bd14cb9c31c80264accd18f506f7911613177b`, manually pushed by Mihai. Both resources are in Frankfurt. The dashboard estimate is **USD 13.30/month**: USD 7 web compute plus USD 6.30 database compute/storage. Mihai activated these resources manually. The instructions below describe the existing setup; do not create a duplicate Blueprint.

The supplied `render.yaml` provisions paid resources. Review the final monthly estimate in Render before applying it. The selected initial sizes are a 512 MB web service and a 256 MB PostgreSQL instance with 1 GB storage in Frankfurt. Database storage autoscaling and automatic source deploys are disabled. Database access is internal-only. Neither these files nor local testing creates a Render subscription.

## 1. Create the account

Open [Render Dashboard](https://dashboard.render.com/) and sign up or sign in. Choose a Hobby workspace if prompted. Account creation precedes service activation; do not create a database or web service separately when using the Blueprint below.

## 2. Review and manually publish the source branch

From PowerShell:

```powershell
Set-Location 'C:\Projects\Tablekind\Tablekind_Portfolio_20261001-011644\tablekind-spring'
git switch hackathon/paypal-bill-splitting
git status --short --branch
git log --oneline portfolio-before-paypal-ai..HEAD
git diff portfolio-before-paypal-ai..HEAD
git remote get-url origin
git push --set-upstream origin hackathon/paypal-bill-splitting
```

The first two commands select the checkout and intended branch. `status` shows remaining edits; `log` and `diff` review all locally committed hackathon work. The remote should be `https://github.com/Kazumi565/tablekind-portfolio.git`. The final command uploads those commits and sets upstream tracking; you run it yourself. If edits remain, use [REVIEW-AND-PUBLISH](REVIEW-AND-PUBLISH.md) to stage, inspect, scan and commit them before pushing. Do not merge into main for this deployment.

## 3. Prepare the Blueprint

In Render, select **New → Blueprint**, connect GitHub, and grant access to the TableKind repository. Select `Kazumi565/tablekind-portfolio`, branch `hackathon/paypal-bill-splitting`, and the root `render.yaml`. Keep the repository root as the build context. Name the Blueprint `TableKind Hackathon`.

Render should propose exactly two resources: `tablekind-hackathon` and `tablekind-hackathon-db`. Verify Frankfurt, the small paid plans, PostgreSQL 16, and 1 GB storage. Do not add a paid workspace upgrade, a domain, a second database, or extra services for this setup. Review the final costs before **Apply/Create Blueprint**, which activates the resources.

The Blueprint prompts for three values:

| Variable | Value to enter |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Client ID of the verified **US sandbox REST app** |
| `PAYPAL_CLIENT_SECRET` | Secret belonging to that same sandbox app |
| `PAYPAL_MERCHANT_ID` | Merchant ID of that app's US Business sandbox account |

Read these values from the ignored local `.env.hackathon` and enter them directly into Render. Do not paste secrets into chat, GitHub, `render.yaml`, or screenshots. Keep the app credentials and merchant ID together; the earlier German merchant failed compliance checks and is not the verified configuration.

The database connection, signing secret and initial manager password are supplied automatically. Do not copy the local database password or local signing secret to Render. AI starts with `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0`, so initial deployment makes no paid AI requests.

## 4. Verify deployment

Wait for the web service to become **Live**. Copy its actual HTTPS URL; do not guess the hostname. The backend uses Render's `RENDER_EXTERNAL_URL` as the PayPal return origin automatically. Open `<actual-url>/manage`.

In the service's **Environment** settings, reveal `HACKATHON_STAFF_PASSWORD` locally. Sign in at `/manage` with `manager@tablekind.test` and that generated password. Keep it private until you arrange judge access. The initial manager account is created only for a fresh database; changing the environment variable later does not reset the stored account password.

Select **Start EUR dinner**. Confirm the 17-category menu presents 203 unique dishes from 224 stored category entries, and the initial four-item dinner totals EUR 38.01. Refresh once and switch between Mihai, Diego and Ana. Check the first-time dinner guidance and the AI availability message before submitting a request. Verify the generated HTTPS URL is still the origin used for PayPal returns. If you later add a custom domain, set `HACKATHON_APP_URL` to that exact HTTPS origin and redeploy.

For deployment failures, use Render's Logs tab. Share a redacted error message rather than a complete environment export. Readiness is `/actuator/health/readiness`; it must be healthy before the deployment is usable. A 512 MB instance is an initial low-traffic demo size, not a capacity guarantee; review memory metrics after startup and after creating several dinners.

## 5. Enable bounded AI access separately

The API key is now stored in Render's secret environment with Mihai's permission. Temporary hosted tests used a separately approved USD 1 allowance and seven provider calls, then `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0` were deployed again. A fresh request confirmed that AI access is disabled. Ongoing judge usage still needs an approved allowance.

After that ongoing budget is chosen, set an approved positive `AI_MAX_CALLS` and change `AI_CALLS_ENABLED` to `true`. Use `AI_MODEL=gpt-6.1-sol` and `AI_REASONING_EFFORT=low`. Save and redeploy. This cumulative call allowance counts requests in this hosted database and persists across restarts; **seven calls are already recorded**, independently of the seven earlier local calls. A request-count cap is not a dollar-denominated billing cap.

Review a real AI split, ask all affected diners to consent, then complete sandbox PayPal payments with a Personal sandbox buyer. Check that the bill reaches EUR 38.01 paid with zero outstanding and no duplicate captures after reload. See [hosted verification](VALIDATION.md#hosted-https-verification--12-october-2026) for the completed checks and their limits.

Render initially masks environment values behind placeholder fields. When changing an existing value, choose **Show secret**, wait for its actual editable value to load, edit it, then **Save and deploy**. Verify the resulting deployment is Live and the application's behavior changed. Keep secret values hidden before screenshots; do not export the complete environment.

## 6. Prepare judges and maintain the demo

Record the actual demo URL, the exact deployed commit, tested sandbox buyer access, and the judge login/setup procedure. Provide each reviewer a fresh dinner so a previous review's settled bill does not block them. Keep the service, database and approved AI allowance available for the required judging period. Save a database backup before major changes and verify restore instructions. Do a final fresh-browser walkthrough of the complete journey before recording the video and finalizing Devpost.

Normal source auto-deploys are off. After a later manual GitHub push, use **Manual Deploy → Deploy latest commit** on the web service. Blueprint configuration changes can still apply during a Blueprint sync; inspect them before syncing. PayPal remains sandbox-only.

References checked 12 October 2026: [Blueprint specification](https://render.com/docs/blueprint-spec), [default environment variables](https://render.com/docs/environment-variables), [secret environment values](https://render.com/docs/configure-environment-variables), [compute plans](https://render.com/docs/compute-plans), [pricing](https://render.com/pricing).

# Run the hackathon build

The full app is deployed at [tablekind-hackathon.onrender.com](https://tablekind-hackathon.onrender.com/). See [Render status and setup](RENDER-SETUP.md) and the [judge walkthrough](JUDGE-GUIDE.md). The recorded hosted image is `414c060`, with its environment selecting GPT-6 Luna. The complete hosted Luna preview, consent and three-payment journey passed on 16 October. Hosted AI is enabled with cumulative cap 20 at the last verified state; up to USD 5 additional judge usage is approved, but the cap is a request count, not a dollar limit. Controlled judge credential delivery and a fresh-browser access-package test are still being arranged. The instructions below run a separate local installation.

Use Git and Docker Desktop with Linux containers. PowerShell instructions run from the repository root. Node 24 is needed only for frontend development/browser checks; Docker builds the application with Java 21 and PostgreSQL 16.

```powershell
git switch hackathon/paypal-bill-splitting
.\scripts\hackathon\Initialize-Hackathon.ps1
docker compose --env-file .env.hackathon -f compose.hackathon.yaml up --build -d
docker compose --env-file .env.hackathon -f compose.hackathon.yaml ps
```

The initializer refuses to overwrite existing configuration. It creates random database, JWT and manager secrets in ignored `.env.hackathon`. Open this file in your local editor to read the manager email/password. Do not print it into shared terminal output or commit it. Its data volume is `tablekind-hackathon_hackathon-postgres`, distinct from the original portfolio database. Only the frontend binds a host port, on loopback at 5195.

Open [localhost:5195/manage](http://localhost:5195/manage). Sign in, select **Start EUR dinner**, and switch between Mihai, Diego and Ana using the walkthrough. Starting another dinner creates separate records; it does not erase payment recovery information. One manager may create ten scenarios per hour. The generated manager is a powerful private-demo identity: do not make its password public.

## Secure PayPal setup

1. Sign into the [PayPal developer dashboard](https://developer.paypal.com/dashboard/). In **Apps & Credentials**, choose **Sandbox** and create/select a merchant REST app associated with your sandbox business account. Copy its client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` locally. [Official API setup](https://developer.paypal.com/api/get-started/).
2. Set `PAYPAL_MERCHANT_ID` to that business account's merchant ID, not its email or app client ID. Obtain it from the sandbox business account's settings. Use a business account able to accept EUR. Create a Personal sandbox buyer and keep its login details private. One dedicated buyer can approve the three fictional diner payments, as in the verified demo; three separate buyer accounts are optional for broader testing. [Sandbox accounts](https://developer.paypal.com/sandbox-testing/accounts).

3. Keep `HACKATHON_APP_URL=http://localhost:5195` when opening the app on that exact origin. If changing the port, change both `HACKATHON_PORT` and the URL. For a future hosted installation, use its HTTPS origin. Guest identity uses browser session storage, so return to the same origin and tab.
4. Recreate the services with the `up --build -d` command above, then **start a new dinner**. Restaurant-to-merchant binding is captured when the scenario is created; adding a merchant later does not silently change old attempts.

PayPal's [API setup documentation](https://developer.paypal.com/api/get-started/) requires a real Business developer account for testing integrations outside the US. A sandbox merchant's “Business” type does not establish the real developer account's type. The current local configuration uses a US sandbox business merchant: a US buyer successfully approved TableKind's EUR 19.01 checkout on 12 October 2026, and actual capture and exact settlement were verified. The original German merchant failed before approval. Keep sandbox country, restaurant currency and merchant binding distinct.

The PayPal secret stays on the backend. This implementation uses PayPal's official hosted approval URL returned by Orders v2, followed by backend verification/capture. It does not collect card details. All API endpoints are fixed to PayPal sandbox. No live configuration is provided. See [Orders create](https://developer.paypal.com/sdk/orders/v2/orders-create/) and [capture](https://developer.paypal.com/sdk/orders/v2/orders-capture/).

## AI setup and spending gate

On 12 October, Mihai authorized USD 1 for local integration testing. Seven Sol calls completed, followed by six Luna evaluation calls on 16 October; both runs remained within that allowance. Calls are disabled again in that local installation, with thirteen recorded calls and a cumulative cap of thirteen. New installations default to `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0`. The separate hosted installation is enabled with cumulative cap 20, within the approved additional USD 5 judge allowance. Any cumulative cap must exceed the already-recorded usage to permit new calls.

Create a dedicated project named **TableKind Hackathon** in the [OpenAI Platform](https://platform.openai.com/), then create a project API key. Put it in `OPENAI_API_KEY` in the ignored `.env.hackathon` file using your local editor. Keep the key out of chat, frontend configuration and Git. See the [official quickstart](https://developers.openai.com/api/docs/quickstart).

The selected model is `gpt-6-luna`, with `AI_REASONING_EFFORT=low`. The request uses Responses strict JSON output and explicitly sets `reasoning.effort`. See the [model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna). Six real local Luna evaluation cases and the complete hosted Luna payment journey passed on 16 October. Earlier Sol results remain separately recorded in [VALIDATION](VALIDATION.md). The exact judge access package still needs a fresh-browser check. The application sends fictional guest names, item names/IDs, quantities and instructions; do not enter personal or payment credentials into the prompt.

After a test budget is explicitly authorized and API billing/model access is available, enable `AI_CALLS_ENABLED=true`, choose a positive cumulative `AI_MAX_CALLS`, and recreate the backend:

```powershell
docker compose --env-file .env.hackathon -f compose.hackathon.yaml up --build -d backend
```

Calls are counted durably before dispatch; failed/uncertain calls also count. The cap covers the entire hackathon database and survives restarts. It is a request limit, not a dollar limit. Set provider project controls and monitor actual token charges as well. One request is limited to 2,000 instruction characters, 40 accepted item rows, 20 diners, 32,000 serialized UTF-8 bytes and 4,000 output tokens, including reasoning tokens. An incomplete response cannot create a preview; no automatic retry of a paid interpretation occurs. Measure task success and reasoning/output usage before increasing limits.

## The complete scenario

Burger 12.00 EUR belongs to Mihai, pasta 10.00 to Diego, salad 9.00 to Ana, and starter 7.01 initially to Mihai. Total: **38.01 EUR**.

As Mihai, use: “Mihai pays for the burger, Diego pays for the pasta, and everyone shares the starter equally.” The AI proposes references and relative weights; the server computes cents. The starter splits into **2.33 / 2.34 / 2.34 EUR**, with recipients of the extra cents determined by stable guest IDs. Read the displayed totals; do not hard-code one person's extra cent in narration.

Review and confirm the preview. Confirming counts as Mihai's consent; Diego and Ana must agree before the ledger changes. Rejection or withdrawal leaves current amounts intact. Each diner then reserves their own share, optionally adds a tip, follows **Continue to PayPal**, and approves using a personal sandbox buyer. Polling verifies and captures independently of the browser. **Finish approved payment** can request an immediate check. Approval and redirects alone do not settle the ledger.

## Stop, resume and inspect

```powershell
# Stop containers while preserving all recovery and accounting records.
docker compose --env-file .env.hackathon -f compose.hackathon.yaml down
# Resume with the existing database.
docker compose --env-file .env.hackathon -f compose.hackathon.yaml up -d
```

Do not delete the volume while payments are unresolved. Never run `docker compose config` into published logs: interpolated secrets may be printed. Backend errors intentionally omit provider response bodies and credentials.

An unknown capture holds its portions. Do not simulate success, manually edit ledger rows, or start another payment for those portions. Known PayPal orders continue read-only reconciliation even after the safe retry window. Attempts with no known order ID after create retries expire require operator investigation; if capture was never dispatched, the existing cancel action can safely release them. Uncertain captures must remain reserved until authoritative confirmation is available.

## Judge access and hosting

Mihai activated the full Render HTTPS demo with persistent PostgreSQL 16 and the web service in Frankfurt, at the original dashboard estimate of USD 13.30/month. The current interface and Luna journey were recorded on 16 October. Preserve the database through judging. Render source auto-deploys are off; after a manual source push, manually deploy the intended reviewed commit and check the public origin again.

Local Docker is reproducible, but **AI and payment steps are not usable without integration access**. Local calls remain disabled; hosted calls were enabled with cumulative cap 20 for the current recording. Arrange free-to-judges access using the approved additional USD 5 allowance and controlled manager/buyer credentials. Check the actual durable count and billing usage rather than assuming the call cap guarantees USD 5 or enough calls through judging. Never put an API secret in the public repository. Judge credential delivery and the fresh-browser test of [JUDGE-GUIDE](JUDGE-GUIDE.md) remain unfinished.

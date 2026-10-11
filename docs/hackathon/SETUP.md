# Run the hackathon build

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
2. Set `PAYPAL_MERCHANT_ID` to that business account's merchant ID, not its email or app client ID. Obtain it from the sandbox business account's settings. Use a business account able to accept EUR. Create three personal sandbox buyer accounts for the three diners and keep their login details privately. [Sandbox accounts](https://developer.paypal.com/sandbox-testing/accounts).

3. Keep `HACKATHON_APP_URL=http://localhost:5195` when opening the app on that exact origin. If changing the port, change both `HACKATHON_PORT` and the URL. For a future hosted installation, use its HTTPS origin. Guest identity uses browser session storage, so return to the same origin and tab.
4. Recreate the services with the `up --build -d` command above, then **start a new dinner**. Restaurant-to-merchant binding is captured when the scenario is created; adding a merchant later does not silently change old attempts.

PayPal's [API setup documentation](https://developer.paypal.com/api/get-started/) requires a real Business developer account for testing integrations outside the US. A sandbox merchant's “Business” type does not establish the real developer account's type. The current local configuration uses a US sandbox business merchant: a US buyer successfully approved TableKind's EUR 19.01 checkout on 12 October 2026, and actual capture and exact settlement were verified. The original German merchant failed before approval. Keep sandbox country, restaurant currency and merchant binding distinct.

The PayPal secret stays on the backend. This implementation uses PayPal's official hosted approval URL returned by Orders v2, followed by backend verification/capture. It does not collect card details. All API endpoints are fixed to PayPal sandbox. No live configuration is provided. See [Orders create](https://developer.paypal.com/sdk/orders/v2/orders-create/) and [capture](https://developer.paypal.com/sdk/orders/v2/orders-capture/).

## AI setup and spending gate

On 12 October, Mihai authorized USD 1 for integration testing. Seven real calls completed within that allowance, then calls were disabled. New installations default to `AI_CALLS_ENABLED=false` and `AI_MAX_CALLS=0`. The current private installation has seven calls recorded and a cumulative cap of seven. Enabling further calls requires a remaining authorized budget and a cap greater than the already-recorded usage.

Create a dedicated project named **TableKind Hackathon** in the [OpenAI Platform](https://platform.openai.com/), then create a project API key. Put it in `OPENAI_API_KEY` in the ignored `.env.hackathon` file using your local editor. Keep the key out of chat, frontend configuration and Git. See the [official quickstart](https://developers.openai.com/api/docs/quickstart).

The selected model is `gpt-6.1-sol`, with `AI_REASONING_EFFORT=low`. The request uses Responses strict JSON output and explicitly sets `reasoning.effort`; Sol defaults to medium if omitted. See the [model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol). Six real evaluation cases and the complete browser journey passed; measured usage and the small evaluation's limits are in [VALIDATION](VALIDATION.md). The application sends fictional guest names, item names/IDs, quantities and instructions; do not enter personal or payment credentials into the prompt.

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

A hosted HTTPS demo would reduce setup and account friction and improve reproducibility on judges' devices. No hosting was purchased or deployed. Before publication, choose a host with persistent PostgreSQL, secure backend environment variables, HTTPS return origin, restart recovery and bounded AI access. Preserve the database through judging and test the exact public origin.

Local Docker is reproducible, but **AI and payment steps are not usable without integration access**. Arrange a free-to-judges access path: preferably operator-funded hosted AI plus isolated sandbox buyer credentials, or clearly documented controlled access to necessary resources. Never put an API secret in the public repository. This access decision and any costs require Mihai's approval; see the remaining gates in [VALIDATION](VALIDATION.md).

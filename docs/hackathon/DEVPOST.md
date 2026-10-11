# Devpost draft — review after real integration gates

**Project:** TableKind — agree on the split, then pay your share

**Tagline:** Describe a shared meal in plain English, review exact cents, agree together and pay individual shares with PayPal sandbox.

**Creator:** Mihai Bargan, solo participant. Built with AI coding assistance. Existing portfolio project substantially extended during the hackathon; see [baseline disclosure](BASELINE.md).

## Inspiration

A restaurant bill mixes individual dishes and shared food. Equal division can feel unfair, while manually working out each person's items slows the end of a meal. I wanted the group to express its agreement naturally and still see exactly what every person owes.

## What it does

Three friends order individual dishes and a shared starter. A diner describes the split, then reviews an item-by-item preview and resulting totals. Everyone affected must agree before the bill changes. Each diner pays their own confirmed share through PayPal sandbox, and the table keeps an exact remaining balance.

AI interprets the request into structured item and guest references. TableKind checks those references, computes money deterministically and asks for clarification when the request is ambiguous. The model cannot move money or consent for another diner.

PayPal is the checkout step that completes the experience: Orders v2 creates an order for the exact reserved share, PayPal hosts buyer approval, and the backend verifies capture before settling those portions. Durable records and polling protect against retries and interrupted browser sessions.

## How I built it

Java 21, Spring Boot, PostgreSQL, React, TypeScript and Docker. The original portfolio provided ordering, the ledger, manual proposals and votes, command idempotency and test payments. Hackathon work adds a separate EUR scenario, real sandbox API integration, schema-constrained hosted AI interpretation, reviewed atomic proposals, provider recovery and the three-diner interface. The original MDL history is preserved.

The challenging part was preserving the group agreement across delayed network responses. Payment dispatch happens outside database locks; reconciliation uses stored request/order identities. AI previews carry a table revision and must be reviewed again when the table changes.

## What I learned

A useful AI payment experience needs clear limits: natural language helps express intent, deterministic code checks financial facts, and people approve changes to their own responsibility. The visible preview and consent steps are part of the product, not just backend safeguards.

## Next steps

Complete measured model evaluation and the combined AI-to-payment demonstration, then refine judge access. Actual sandbox checks already verified three individual payments, separate tips, completed-payment replay and recovery after approval with the backend stopped. PayPal refunds, live payments, fiscal receipts and real POS integration are outside this entry's scope.

## Fields to finalize before submitting

- Public source URL: `https://github.com/Kazumi565/tablekind-portfolio` with the intended reviewed branch/commit accessible.
- Demo/setup: link the final [setup guide](SETUP.md); add an approved hosted HTTPS URL if one is deployed.
- Video: add the publicly visible YouTube link after recording and manual publication.
- Testing access: provide controlled demo-manager and sandbox buyer access through the agreed judge channel; never publish API secrets.
- Validation: replace this draft's future-work wording only after the real gates in [VALIDATION](VALIDATION.md) pass. As of 12 October, actual sandbox payments, tips, replay and restart recovery are verified. Hosted AI evaluation and the complete AI-to-payment demonstration remain unverified.

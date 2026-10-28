# TableKind — judge walkthrough

**Demo:** [tablekind-hackathon.onrender.com](https://tablekind-hackathon.onrender.com/)
**Source:** [hackathon/paypal-bill-splitting](https://github.com/Kazumi565/tablekind-portfolio/tree/hackathon/paypal-bill-splitting)
**Video:** [Final demonstration (unlisted)](https://youtu.be/bPw2PLDuaUk).

This guide is ready for access testing. **Judge access delivery is still being arranged.** A completed operator walkthrough does not establish that a judge has received working credentials.

## Before you begin

Use the demo-manager sign-in and Personal PayPal sandbox-buyer login provided in the private judge-access instructions. These are two different accounts. No personal PayPal account, real payment card, OpenAI API key or purchase is required for the hosted walkthrough. Sandbox payments use fictional funds.

The one-browser demonstration lets you switch between Mihai, Diego and Ana. It represents three application identities; it is not a demonstration of three simultaneous human users. A single dedicated sandbox buyer may be reused for the three checkout approvals, as in the recorded verification.

## 1. Start a fresh dinner

Open [the manager sign-in](https://tablekind-hackathon.onrender.com/manage), sign in with the supplied demo access, and select **Start EUR dinner**. Use the prepared meal rather than placing additional orders for this walkthrough. One manager may create ten dinners per hour.

The initial bill is:

| Dish | Initial owner | EUR |
| --- | --- | ---: |
| Burger | Mihai | 12.00 |
| Pasta | Diego | 10.00 |
| Salad | Ana | 9.00 |
| Shared starter | Mihai | 7.01 |
| **Total** | | **38.01** |

Initial totals are Mihai **19.01**, Diego **10.00** and Ana **9.00**. Starting a fresh dinner creates separate records; it does not erase earlier payments. **Show guide** explains the next step if the walkthrough panel was dismissed.

## 2. Describe and review the split

Switch to Mihai. In the split assistant, use:

> Mihai pays for the burger, Diego pays for the pasta, Ana pays for the salad, and all three share the starter equally.

Select **Preview split with AI** once and wait for the result. GPT-6 Luna interprets the request; the server validates the referenced dishes and diners and calculates cents. The preview should leave each individual dish with its owner and split the starter into **2.33 / 2.34 / 2.34 EUR**. Stable guest IDs determine which diner receives the smaller share, so a fresh dinner may assign that cent differently from the video. All shares must still total **EUR 38.01**.

Creating a preview does not change the bill or initiate a payment. If the table changes while the request is running, review the current state and request a new preview. If the assistant asks for clarification, do not confirm an unintended split.

## 3. Obtain each diner's consent

Review the exact amounts, then select **Confirm preview and propose** as Mihai. His confirmation records his consent. Switch to Diego and agree, then inspect the bill: it must still have the original totals while Ana's agreement is missing. Switch to Ana and agree. Only the last required agreement applies the proposed shares.

These perspective switches are a demo convenience. The application still records each diner's decision under the corresponding guest identity. A rejection leaves the previous split in place.

## 4. Pay the confirmed shares

Switch to Mihai and choose **Pay my share**. Keep the optional tip at zero for the EUR 38.01 check. Select **Reserve my share for PayPal**, then **Continue to PayPal**.

Use the provided Personal sandbox-buyer login on PayPal's sandbox checkout and approve the displayed payment. Check that the EUR order matches the reserved share. A US sandbox funding method may also display a USD conversion. Return to the same TableKind origin and browser tab and wait for payment verification. **Finish approved payment**, when present, requests an immediate check; approval or a redirect alone does not settle the bill.

Repeat for Diego and Ana. The backend verifies the stored order, local payment reference, merchant, currency, gross amount and completed capture before marking reserved portions paid. If a payment is pending or uncertain, wait for the original attempt to resolve instead of starting a replacement.

## 5. Verify the result

Expand **Whole-table totals**. With zero tips and no extra orders, expect:

- **Paid: EUR 38.01**
- **Outstanding: EUR 0.00**
- **Reserved, still unpaid: EUR 0.00**

Reload. The completed payments and zero remaining balance should persist. The recorded hosted Luna walkthrough reached this result on 16 October 2026. That run's exact shares were Mihai 14.34, Diego 12.33 and Ana 11.34 EUR; fresh dinners may place the rounding cent differently.

## If access or AI is unavailable

The assistant checks availability before submission. A disabled or exhausted allowance is an operator configuration issue; contact the submission owner through the provided judge channel. Judges should not add billing or supply a private API key. The manual dish-sharing controls remain usable, but using them does not replace the AI part of the verification.

If no fresh dinner can be created, check the supplied manager access and the ten-per-hour limit. If the guide or guest identity is lost after opening another browser, return to the original tab or start a fresh dinner; never paste guest tokens into a public report. If checkout remains unresolved, preserve the original attempt and ask the owner to inspect it. Do not edit the database or simulate success.

For a separate local installation, use [SETUP](SETUP.md). Local Docker needs its own provider configuration; it is not a credential-free substitute for the hosted integration.

## Owner's access handoff — complete before sharing

- Provide the correct demo-manager and tested sandbox-buyer access through the permitted private judge-access field/channel. The manager is a powerful demo account, not a dedicated read-only judge role.
- Rehearse this exact guide from a fresh browser with the same credentials judges will receive. Check that judges can create their own fresh dinner without the owner's existing browser session.
- Check the real `ai_usage` count and remaining cumulative allowance. The last verified hosted configuration is Luna, enabled, cap 20. Do not assume 20 unused calls remain.
- Keep Render, PostgreSQL, the PayPal sandbox app and bounded AI access available through the required judging period. Review usage against the authorized USD 5 allowance; the request cap is not a monetary cap.
- Verify the final source/demo/video links signed out. Record the final deployed commit and access-test date in [VALIDATION](VALIDATION.md).

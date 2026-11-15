# Tablekind walkthrough

Three diners share a meal costing **EUR 38.01**. Tablekind turns their intended split into a reviewable proposal, waits for everyone's agreement, and collects each share through PayPal sandbox checkout.

**[Watch or download the 89-second walkthrough](assets/tablekind-walkthrough.mp4)** · [Full 2:19 demo](https://youtu.be/bPw2PLDuaUk) · [Payment-recovery case study](PAYMENT-RECOVERY.md) · [Run locally](../hackathon/SETUP.md)

## Follow the demonstration

The timestamps below refer to the published full-length recording.

| Time | What to watch | Why it matters |
| --- | --- | --- |
| 0:10–0:30 | Burger, pasta, salad and the shared starter total EUR 38.01. | The bill begins with concrete accepted items and their owners. |
| 0:32–1:02 | An instruction keeps the mains with their diners and splits the starter. | Interpretation is validated; amounts are calculated in whole cents. |
| 1:02–1:10 | A preview shows the proposed balances. | A preview does not change who owes money or take payment. |
| 1:10–1:26 | Mihai, Diego and Ana agree. | The split takes effect only after the required consent. |
| 1:26–1:45 | Mihai reserves his share and approves PayPal sandbox checkout. | The server verifies the captured result before marking his share paid. |
| 1:45–1:57 | The other payments finish and a reload retains settlement. | The final bill has nothing outstanding; it is persisted state. |

The recorded shares are **Mihai EUR 14.33, Diego EUR 12.34 and Ana EUR 11.34**, with no tips. A new dinner may assign the rounding cent differently because the tie-break uses stable guest IDs. The sum remains EUR 38.01.

## What the recording shows

The demonstration uses real sandbox provider responses and fictional funds from the verified **28 October 2026** journey. It is an edited presentation of captured interface views, with synthetic narration, rather than a continuous browser recording. One sandbox buyer account was reused to test the three application diners. The two later payments are abbreviated in the film.

The film shows the successful journey. The lost-response failure and recovery are established separately by the executable tests in the [engineering case study](PAYMENT-RECOVERY.md); they are not presented as footage in this video.

## Short portfolio edit

A new **89.4-second** cut retains the bill, interpretation, preview, consent, checkout and settlement sequence. It reuses the approved footage, narration and burned-in captions; no new AI requests or payments were made for the edit. The exact-cent explanation and the longer project introduction remain available in the full film.

The short MP4 is included in this repository. Captions are already visible in the video. The full-length demo remains available through the YouTube link above.

[Original video provenance](../hackathon/VIDEO.md) · [Sandbox recording evidence](../hackathon/evidence/video-export-4k-v04-results.json)

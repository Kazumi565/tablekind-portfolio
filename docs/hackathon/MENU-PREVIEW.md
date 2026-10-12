# Menu and design preview

The hackathon menu contains **228 selectable entries across 17 categories**: 216 selections adapted from a dated Andy’s Pizza Moldova menu snapshot, plus the 12 original TableKind dishes. Each relevant source category independently meets the requested 70% minimum. Portions and source-category overlaps count as separate selections; the [coverage record](MENU-COVERAGE.md) lists the exact scope and calculation.

The menu uses **27 original illustrative photos**. Related dishes can reuse a category photo, so the image does not promise an exact recipe or portion. Names and descriptions are adapted for TableKind, and prices are fictional EUR demo values. Ingredient and allergen hints require restaurant confirmation; an empty hint list does not mean allergen-free. See [photo provenance](MENU-ASSETS.md), [additional food images](MENU-ASSETS-EXPANSION.md) and [drink images](MENU-ASSETS-DRINKS.md).

## Full local application

Run the isolated stack using [SETUP](SETUP.md), then open [the manager view](http://localhost:5195/manage) and choose **Start EUR dinner**. Newly created dinners receive the expanded menu. Existing dinners retain their earlier catalog and accepted orders; their history is not rewritten.

The initial accepted meal remains **€38.01**, with the same four items allocated to Mihai, Diego and Ana. Browsing additional items does not change that bill. Placing and accepting more orders uses the existing application workflow. The shared menu view adds photos, search, categories, a vegetarian filter and batches of 24 cards, with a category selector on small screens.

Flyway V13 adds an optional local image path to products. The schema remains compatible with products that have no photo. The original MDL application and the isolated EUR hackathon database remain separate.

## Standalone menu preview

The standalone build lets a viewer browse the menu, open dish details and build a temporary meal plan. Its basket stays in memory and resets when the page reloads; it does not place an order, call the AI provider or take a payment. The interface labels this boundary.

With Node.js 22.12 or newer, from the repository root:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run test:menu
npm.cmd --prefix frontend run build:menu
npm.cmd --prefix frontend run preview -- --outDir dist-menu --port 5196
```

Open [the local menu preview](http://localhost:5196). Keep the terminal running; Ctrl+C stops that preview server. `build:menu` sets its own build flag and writes `frontend/dist-menu/`. The ordinary `npm.cmd --prefix frontend run build` command still builds the full application into `frontend/dist/`.

## Maintaining the catalog

`backend/src/main/resources/demo/menu.json` is the shared source for new hackathon dinners and the static menu preview. Edit that fixture, then regenerate and validate the frontend copy:

```powershell
npm.cmd --prefix frontend run menu:sync
npm.cmd --prefix frontend run test:menu
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run build:menu
```

`menu:sync` writes `frontend/src/previewMenu.ts`; edit the fixture instead of that generated file. `test:menu` checks synchronization, category coverage, local image references and the preserved initial dinner.

Validation on 12 October 2026 passed all three catalog tests and four focused backend tests across `CatalogMenuTest`, `HackathonMenuTest` and `EurJourneyTest`. Both frontend builds passed, and the Docker stack was healthy with V13 applied. Browser checks covered the 228-entry catalog, 17 categories, pagination, filters, empty-search recovery, meal-plan quantities and the 390-pixel phone layout. In the full application, a fresh €38.01 dinner accepted a €7.50 House breakfast order, reaching €45.51 total and €26.51 for Mihai. See [VALIDATION](VALIDATION.md) for the recorded scope.

## Hosting status

The authorized menu preview is deployed on ChatGPT Sites: [TableKind — Good food, shared well](https://tablekind-at-the-table.workspace-326781.chatgpt.site). It is **owner-private**. This URL is suitable for the owner's review; it does not yet provide judge access.

ChatGPT Sites and GitHub Pages can serve this static menu preview. They cannot directly run the existing Java/Spring Boot and PostgreSQL application. The full application remains local. A complete hosted split → preview → consent → PayPal journey needs a backend host and persistent database, or judges can follow the local Docker setup. Paid hosting, a domain and ongoing judge AI usage remain undecided.

GitHub publication remains manual. Follow [REVIEW-AND-PUBLISH](REVIEW-AND-PUBLISH.md); authorization to host a preview does not authorize pushing this branch, merging remotely or publishing a release.

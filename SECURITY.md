# Security

Tablekind is a local portfolio prototype. Its payment/POS adapters, cash and terminal records, and practice reservations are for fictional scenarios only. It is not supported for processing real customer money or operating a restaurant.

## Local credentials

The local Compose profile intentionally contains public development defaults. The seeded account is for a fresh local database only. These values must not protect any public service or private customer data.

The private demo generates independent credentials in `.env.demo`. Its signing secret also protects stored MFA material and QR links. Preserve that file privately with the matching database. Changing bootstrap settings does not rotate an existing account, and replacing the signing secret can make stored encrypted material unreadable.

## Reporting

Use GitHub's **Security → Report a vulnerability** when private vulnerability reporting is enabled for this repository. If that option is unavailable, open an issue asking for a private reporting channel without including exploit details, credentials or personal data.

Do not publish tokens, account recovery codes, database copies or another installation's private address in an issue. Use fictional local fixtures for reproduction.

## Repository checks

- `.gitignore` and the packaging script exclude common private/generated paths.
- `scripts/security/review_source.py --staged` inspects every file in the Git index and returns filenames/line numbers without matched secret values.
- Gitleaks uses its default rules plus one exact, file-scoped exception for the published RFC 6238 test vector. It does not ignore tests or configuration files wholesale.
- The portfolio CI runs source checks and development tests. A successful scan is not proof that a repository has no sensitive content.

Public publishing instructions are in [docs/PUBLICATION.md](docs/PUBLICATION.md). Keep the original private repository, its history and private demo configuration separate from the new portfolio repository.

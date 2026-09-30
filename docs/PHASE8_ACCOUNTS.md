# Phase 8 accounts and interface boundaries

## Identity model

There are four interface areas and four backend actor kinds. A restaurant owner
uses the management interface with an individual STAFF identity. OWNER is a
membership role in one restaurant, not a shared account and not a platform role.

| Identity or role | Authority |
| --- | --- |
| PLATFORM | Platform overview, restaurant/owner provisioning, legacy ownership assignment, platform audit and own administrator security |
| STAFF / OWNER | All manager operations, create/remove managers, change staff roles and transfer ownership |
| STAFF / MANAGER | Restaurant setup, operational reports, TEST POS, financial corrections, waiter account creation/removal and service operations |
| STAFF / WAITER | Tables, orders, assistance, availability and permitted TEST collections |
| CUSTOMER | Own profile, linked visit summaries, account security and recovery of an already linked guest |
| GUEST | Existing scoped table participation, ordering, sharing and TEST checkout |

Every identity is validated against its own table and current token version.
Customer and platform tokens cannot act as staff or table guests. UI visibility
is supplementary to backend authorization. Removing or changing a membership
affects subsequent requests, including privileged receipt replay.

Restaurant owners and managers may retain the existing restaurant-creation flow;
the creator owns the new restaurant. Waiters and removed staff cannot use it.
Initial local/demo bootstrap still creates the fictional restaurant on an empty
database. It never provisions a platform administrator.

## Restaurant ownership

Each restaurant has at most one OWNER, enforced by a partial unique index.
V6 promotes a recorded restaurant creator only when that identity remains an
active manager. It does not guess an owner from an email or the first staff row.
Legacy restaurants without sufficient evidence remain unassigned. A platform
administrator can assign one of their existing active managers after review.
This action requires administrator password, a fresh authenticator/recovery code
and a recorded reason. It cannot overwrite existing ownership.

An owner can promote/demote waiters and managers. Managers can create/remove
waiters only. Owners cannot be removed through the staff removal endpoint.
Ownership transfer requires an existing active manager and a reason. The sender
becomes a manager. The original transfer receipt can still replay for that
sender while they remain a manager and the recipient remains owner; the exact
request key, body and recorded transfer must match. This does not permit another
transfer after demotion. Role/membership changes take the restaurant row lock.

Existing-account invitations, branch-specific membership and a separate kitchen
or cashier role are not included. Staff account password/MFA management retains
the existing individual security screen.

## Optional customer accounts

Anonymous QR joining remains the default and requires no account. Optional
registration uses a case-insensitive username, password, display name and menu
language. No email address or phone number is collected, verified or claimed to
be verified. Usernames use 3–32 letters, digits or underscores. Passwords use
BCrypt and the existing 12-character minimum / 72 UTF-8-byte maximum.

Registration displays a 256-bit recovery code once. The database stores its
SHA-256 hash. Recovery requires the username and that code, resets the password,
rotates the recovery code and revokes all account and linked-guest tokens.
A signed-in customer may replace the code after proving the current password.
There is no email/SMS reset or support bypass.

Customers explicitly link the guest currently controlled by their tab. The
request must prove both identities using independently validated tokens. An
account cannot claim two guests at the same table session or take over another
account's linked guest. The customer row and session/guest rows serialize linking;
a unique database index provides an additional concurrency boundary.

Resuming a linked visit requires an open session and an active, non-revoked
guest. It issues a GUEST token for the same guest ID. It does not create another
guest, move an item, rewrite an allocation, reopen a table or settle money.
An account alone cannot join an unlinked table. Staff revocation still blocks
recovery. A revoked linked guest continues to occupy that account's link for
the session, so creating another guest cannot silently replace it.

The profile shows the latest 100 explicitly linked visits and the customer's
own allocated/settled share. A settled share may have been covered by another
diner. It is not a bank statement or fiscal receipt. Other diners' account
identities and visit histories are not exposed. Restaurants continue seeing the
table nickname, not the customer's username or account record.

Account deletion requires all linked sessions to be closed. It removes the
links, scrubs the account's username/display name/credentials and revokes tokens.
Restaurant guest nicknames, financial records and minimal immutable security
events remain. This is not a claim of complete financial-record erasure or a
finished legal retention policy.

## Platform administration

Platform identities live in a separate table. The local operator provisions the
single initial administrator through `scripts/admin/Create-PlatformAdmin.ps1`.
The command reads credentials from stdin and refuses to replace an existing
administrator. Ordinary application startup and HTTP requests cannot provision
an administrator. There are no default administrator credentials.

Sign-in always requires password plus an authenticator or single-use recovery
code. Authenticator seeds are encrypted with the existing secret box. Preserve
the existing signing/MFA secret with backups. Platform tokens expire after 30
minutes and never confer restaurant membership or guest access.

Provisioning a restaurant and its new owner, or assigning an unowned legacy
restaurant, requires fresh administrator proof and a reason. The operation and
its command receipt commit together. Passwords/proof are not placed in browser
recovery records or audit entries; request fingerprints are stored server-side.
The browser preserves only the administrator ID, request key and business fields
so an uncertain request can be retried after reload with re-entered credentials.

Administrator security replacement requires a sign-in from the last five minutes,
current password and successful setup of a new authenticator. Active MFA remains
unchanged until the new authenticator code is confirmed. Replacement revokes all
platform tokens and rotates the recovery code. This also supports recovery-code
sign-in when the old authenticator was lost. Losing both authenticator and code
requires a deliberate offline recovery procedure; no HTTP bypass is provided.

Platform overview exposes at most 200 restaurants, owner contact, branch/staff/
open-table counts and failed TEST POS message counts. The audit view shows the
latest 100 platform actions. It does not expose customer visit histories,
table-level financial details, impersonation, subscription billing or a live
infrastructure monitoring service. Platform and restaurant audits are separate.

## Browser recovery limits

The four areas share one React project and backend. Platform UI code is loaded
only on `/admin`; it uses a separate per-tab token from staff/customer/guest
credentials. Route separation is not separate hosting or origin isolation.

The existing ordinary command journal retains exact actor/key/body across
reload. Account login, registration and security changes keep separate flows;
passwords, recovery codes and MFA seeds are never written to that journal.
Account registration relies on unique usernames: after a lost registration
response, sign in and replace the recovery code if necessary.

While a guest command is pending, account changes and switching to other guests
are blocked. Signing into a linked account and restoring exactly the same guest
is allowed to recover expired guest access, after which the original saved
command can be retried. Uncertain commands from another tab/device are not
synchronized. Keep the original tab until its outcome has been reconciled.

If a password or recovery response is lost, try signing in with the new password.
Then replace the recovery code if needed. Never infer that a security change
failed solely because its response was lost. Session storage remains per tab,
so closing/clearing the tab removes saved sign-ins and recovery state.

Loyalty, favourites, dietary profiles, reservations, takeaway, email/SMS delivery,
saved payment instruments, provider credentials and real integrations are outside
this phase. Every payment/POS flow remains TEST-only or unconfigured.

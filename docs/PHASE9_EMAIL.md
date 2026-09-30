# Phase 9 — local customer email

## What works

Optional customer accounts support local email verification and forgotten-password
recovery. Anonymous QR joining, ordering and TEST payment remain available without
an account. Staff/owner and platform identities remain separate from customers;
this update does not add staff email resets, SMS, social sign-in or reservations.

The local and private-demo Compose stacks start separate Mailpit containers.
SMTP is internal to each Docker network. Only the web inbox is published, bound
to loopback: local port 8025, demo port 8026. No SMTP relay, outbound delivery,
public inbox route, service subscription or domain is configured. Inbox contents
are temporary and limited to 200 messages. Do not enter real personal data in the
demo; use fictional addresses such as `guest@example.test`.

Messages contain an eight-digit code, valid for ten minutes and accepted once.
A resend is allowed after 60 seconds and replaces the old challenge. Five invalid
attempts consume a challenge. Request limits also apply by account/address and IP.
Codes are never included in API responses or application logs. They are stored as
keyed hashes; the queued delivery copy is encrypted using the existing secret box
until delivery, expiry or cancellation. Queue status contains no raw SMTP errors.

A worker claims one row at a time and makes bounded local SMTP calls. Failures
retry after 10, 20, 30 and 40 seconds; five failed attempts mark delivery FAILED.
Use **Check delivery** to refresh status. After fixing Mailpit, **Resend code**
queues a replacement. A crash after SMTP acceptance can deliver the same code
again; verification still accepts it only once. Mailpit failure does not make
ordering depend on email availability.

## Guest journey

1. Open **My account**, or `/guest/account`, and create an optional account.
2. Save the separate recovery code privately; hide it after saving.
3. Open the desktop Mailpit inbox and select the fictional recipient/message.
4. Enter its code under **Email verification code**. On a phone, ask the demo
   host to read the code from the host's private inbox.
5. Choose **Link my current table**. Linking is explicit; it preserves the guest
   identity, items, individual bill amounts and pending command identity.
6. On another browser, sign in and resume the same linked guest.

When local email is enabled, existing accounts can still sign in and view their
profile. They must add/verify an address before linking or resuming a visit.
Existing anonymous guest tokens keep working. No account is silently attached to
a table and no historical guest is claimed by matching an email or nickname.

An unverified account does not reserve an address. Only one active account may
hold a verified address. Changing an address requires the current password and
verification of the new address; the old verified address remains valid until
that succeeds. Verifying the replacement invalidates outstanding reset codes.

## Recovery and revocation

**Forgot password?** asks for the username and previously verified address.
The response is identical for unknown accounts, unverified addresses and matches.
Only a match queues a reset code. Enter the code and a new password, then sign in.
The reset revokes customer sessions and linked-guest tokens, clears outstanding
email challenges and the previous backup recovery code, and preserves restaurant
financial records. Other guests at the table retain their access.

After a reset, generate a replacement backup recovery code in account security.
If the final response is lost, try signing in with the new password before
requesting another reset. A consumed code cannot be replayed. Password changes,
all-device sign-out and account deletion invalidate outstanding email challenges.
Deletion also removes the stored email fields while retaining required table and
financial history under the existing deletion rules.

## Configuration and future live email

`EMAIL_MODE` defaults to OFF for direct backend starts. Compose explicitly sets
LOCAL_SMTP. Local capture is allowed only in local/demo profiles and only with
Mailpit or a loopback SMTP host on a non-privileged port. Hardened deployment
rejects it. OFF retains the existing username/password and recovery-code behavior.

A LOCAL_SMTP verification is explicitly marked TEST in storage and the interface.
It is not evidence of real-mailbox ownership. A future live provider needs its
own reviewed mode, sender/domain setup, fresh ownership verification, delivery
security and operational acceptance. These are not implemented in 0.9.0. Do not
point LOCAL_SMTP at an external relay or enable forwarding in Mailpit.

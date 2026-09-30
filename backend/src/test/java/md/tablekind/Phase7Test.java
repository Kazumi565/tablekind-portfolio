package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.junit.jupiter.api.Test;

class Phase7Test extends WorkflowSupport {
  String base() {
    return "/restaurants/" + rid;
  }

  String printed() {
    return post(staff, base() + "/tables/" + tid + "/link", Map.of()).path("token").asText();
  }

  String email;

  String account(String role) {
    email = "security-" + UUID.randomUUID() + "@example.test";
    return post(
            staff,
            base() + "/staff",
            map(
                "email",
                email,
                "displayName",
                "Test staff",
                "password",
                "New-Staff-Password!",
                "role",
                role))
        .path("id")
        .asText();
  }

  String login() {
    return post(null, "/auth/login", map("email", email, "password", "New-Staff-Password!"))
        .path("accessToken")
        .asText();
  }

  @Test
  void printedLinkRequiresAnActiveEnabledSessionAndRotationRevokesIt() {
    String link = printed();
    var inspect = ok(null, "GET", "/api/table-links/" + link, null);
    assertEquals(sid, inspect.path("sessionId").asText());
    var body = map("token", link, "sessionId", sid, "nickname", "QR guest");
    String key = UUID.randomUUID().toString();
    var joined = send(null, "POST", "/api/table-links/join", body, key);
    assertEquals(200, joined.status());
    assertEquals(joined.body(), send(null, "POST", "/api/table-links/join", body, key).body());
    assertEquals(3, state().path("guests").size());
    fails(
        409,
        null,
        "/table-links/join",
        map("token", link, "sessionId", UUID.randomUUID(), "nickname", "Wrong group"));
    printed();
    assertEquals(410, send(null, "GET", "/api/table-links/" + link, null, null).status());
    assertEquals(410, send(null, "POST", "/api/table-links/join", body, key).status());
    String fresh = printed();
    db.update("UPDATE dining_table SET pilot_enabled=false WHERE id=?", UUID.fromString(tid));
    assertEquals(410, send(null, "GET", "/api/table-links/" + fresh, null, null).status());
    db.update("UPDATE dining_table SET pilot_enabled=true WHERE id=?", UUID.fromString(tid));
    db.update(
        "UPDATE table_session SET qr_expires_at=now()-interval '1 minute' WHERE id=?",
        UUID.fromString(sid));
    assertEquals(409, send(null, "GET", "/api/table-links/" + fresh, null, null).status());
  }

  @Test
  void closedPrintedLinkNeverOpensANewGroupAndRejectsTampering() {
    String link = printed();
    action(staff, "/close");
    assertEquals(409, send(null, "GET", "/api/table-links/" + link, null, null).status());
    assertEquals(
        410,
        send(
                null,
                "GET",
                "/api/table-links/" + link.substring(0, link.length() - 2) + "xx",
                null,
                null)
            .status());
    var next = post(staff, base() + "/tables/" + tid + "/sessions", Map.of());
    fails(
        409,
        null,
        "/table-links/join",
        map("token", link, "sessionId", sid, "nickname", "Old group"));
    assertEquals(
        next.path("sessionId"),
        ok(null, "GET", "/api/table-links/" + link, null).path("sessionId"));
  }

  @Test
  void revokedJoinCannotBeReplayedFromAnOldReceipt() {
    String key = UUID.randomUUID().toString();
    var body = map("token", join, "nickname", "Third");
    var result = send(null, "POST", "/api/join", body, key);
    assertEquals(200, result.status());
    action(staff, "/guests/" + result.body().path("actorId").asText() + "/revoke");
    assertEquals(401, send(null, "POST", "/api/join", body, key).status());
    assertEquals(
        401,
        send(result.body().path("accessToken").asText(), "GET", "/api/sessions/" + sid, null, null)
            .status());
  }

  @Test
  void waiterAndCrossRestaurantCannotUseManagerSetupOrReports() {
    account("WAITER");
    String waiter = login();
    for (String path :
        List.of(
            base() + "/audit",
            base() + "/onboarding",
            base() + "/pos",
            base() + "/tables/" + tid + "/link",
            "/sessions/" + sid + "/payments/reconciliation"))
      assertEquals(403, send(waiter, "GET", "/api" + path, null, null).status(), path);
    assertEquals(200, send(waiter, "GET", "/api" + base(), null, null).status());
    String other = post(staff, "/restaurants", map("name", "Other restaurant")).path("id").asText();
    assertEquals(
        403, send(waiter, "GET", "/api/restaurants/" + other + "/audit", null, null).status());
    assertEquals(403, send(at, "GET", "/api" + base() + "/onboarding", null, null).status());
  }

  @Test
  void managerDemotionBlocksConfigurationAndCancellationReceiptReplay() {
    String id = account("MANAGER"), token = login();
    String key = UUID.randomUUID().toString();
    var body = map("names", map("en", "New category"), "sortOrder", 1);
    assertEquals(200, send(token, "POST", "/api" + base() + "/categories", body, key).status());
    String item = item();
    var cancel = rev("status", "CANCELLED", "reason", "Wrong order");
    String ck = UUID.randomUUID().toString();
    assertEquals(
        200,
        send(token, "POST", "/api/sessions/" + sid + "/orders/" + item + "/status", cancel, ck)
            .status());
    db.update(
        "UPDATE membership SET role='WAITER' WHERE restaurant_id=? AND staff_id=?",
        UUID.fromString(rid),
        UUID.fromString(id));
    assertEquals(403, send(token, "POST", "/api" + base() + "/categories", body, key).status());
    assertEquals(
        403,
        send(token, "POST", "/api/sessions/" + sid + "/orders/" + item + "/status", cancel, ck)
            .status());
  }

  @Test
  void waiterSubmittedCancellationReplaysWithoutAnotherEvent() {
    account("WAITER");
    String waiter = login();
    String item = action(at, "/orders", "productId", pid, "productVersion", 1,
        "quantity", 1, "optionIds", List.of(), "note", "").path("id").asText();
    String path = "/api/sessions/" + sid + "/orders/" + item + "/status";
    String key = UUID.randomUUID().toString();
    var body = rev("status", "CANCELLED", "reason", "");
    var first = send(waiter, "POST", path, body, key);
    assertEquals(200, first.status());
    long revision = revision();
    var replay = send(waiter, "POST", path, body, key);
    assertEquals(200, replay.status());
    assertEquals(first.body(), replay.body());
    assertEquals(revision, revision());
    assertEquals(0, db.number("SELECT count(*) FROM bill_entry WHERE item_id=?", UUID.fromString(item)));
    var changed = new LinkedHashMap<>(body);
    changed.put("reason", "Different body");
    assertEquals(409, send(waiter, "POST", path, changed, key).status());
    assertEquals(409, send(waiter, "POST", path, body, UUID.randomUUID().toString()).status());
  }

  @Test
  void removedWaiterCannotReplaySubmittedCancellation() {
    String id = account("WAITER"), waiter = login();
    String item = action(at, "/orders", "productId", pid, "productVersion", 1,
        "quantity", 1, "optionIds", List.of(), "note", "").path("id").asText();
    String path = "/api/sessions/" + sid + "/orders/" + item + "/status";
    String key = UUID.randomUUID().toString();
    var body = rev("status", "CANCELLED", "reason", "");
    assertEquals(200, send(waiter, "POST", path, body, key).status());
    ok(staff, "DELETE", "/api" + base() + "/staff/" + id, null);
    assertEquals(403, send(waiter, "POST", path, body, key).status());
  }

  @Test
  void acceptedFreeItemCancellationStillRequiresManagerOnReplay() {
    String id = account("MANAGER"), manager = login();
    db.update("UPDATE product SET price_bani=0 WHERE id=?", UUID.fromString(pid));
    String item = item();
    String path = "/api/sessions/" + sid + "/orders/" + item + "/status";
    String key = UUID.randomUUID().toString();
    var body = rev("status", "CANCELLED", "reason", "Free item correction");
    assertEquals(200, send(manager, "POST", path, body, key).status());
    db.update("UPDATE membership SET role='WAITER' WHERE restaurant_id=? AND staff_id=?",
        UUID.fromString(rid), UUID.fromString(id));
    assertEquals(403, send(manager, "POST", path, body, key).status());
  }

  @Test
  void payAtTableBlocksGuestOrderingButKeepsExistingBillAndStaffOrdering() {
    item();
    var prior = state().path("bill");
    ok(
        staff,
        "PUT",
        "/api" + base() + "/branches/" + bid + "/policy",
        map(
            "operatingMode",
            "PAY_AT_TABLE",
            "languages",
            List.of("ro", "en"),
            "defaultLanguage",
            "ro"));
    assertEquals(prior, state().path("bill"));
    assertEquals("PAY_AT_TABLE", state().path("table").path("operating_mode").asText());
    var body =
        rev(
            "productId",
            pid,
            "productVersion",
            1,
            "quantity",
            1,
            "optionIds",
            List.of(),
            "note",
            "");
    fails(409, at, "/sessions/" + sid + "/orders", body);
    body.put("orderedBy", a);
    post(staff, "/sessions/" + sid + "/orders", body);
    assertEquals(
        400,
        send(
                staff,
                "PUT",
                "/api" + base() + "/branches/" + bid + "/policy",
                map(
                    "operatingMode",
                    "PAY_AT_TABLE",
                    "languages",
                    List.of("en"),
                    "defaultLanguage",
                    "ro"),
                UUID.randomUUID().toString())
            .status());
  }

  @Test
  void checklistReflectsRestaurantEvidenceWithoutClaimingLiveReadiness() {
    var r = ok(staff, "GET", "/api" + base() + "/onboarding", null);
    assertFalse(r.path("liveReady").asBoolean());
    assertFalse(r.path("checks").path("printedLinks").asBoolean());
    printed();
    account("WAITER");
    item();
    var after = ok(staff, "GET", "/api" + base() + "/onboarding", null).path("checks");
    assertTrue(after.path("printedLinks").asBoolean());
    assertTrue(after.path("testOrder").asBoolean());
    assertTrue(after.path("staff").asBoolean());
    assertFalse(after.path("testPayment").asBoolean());
    String audit = ok(staff, "GET", "/api" + base() + "/audit", null).toString();
    assertFalse(audit.contains("New-Staff-Password!"));
    assertFalse(audit.contains("joinToken"));
  }

  @Test
  void mfaEnrollmentRecoveryReplayAndPasswordRevocation() {
    String id = account("MANAGER"), token = login();
    String password = "New-Staff-Password!";
    var setup = post(token, "/auth/mfa/setup", map("password", password));
    String seed = setup.path("secret").asText();
    assertFalse(
        db.one("SELECT mfa_pending FROM staff_account WHERE id=?", UUID.fromString(id))
            .toString()
            .contains(seed));
    fails(401, token, "/auth/mfa/enable", map("password", password, "code", "bad"));
    String code = Totp.code(seed, Instant.now().getEpochSecond() / 30);
    var enabled = post(token, "/auth/mfa/enable", map("password", password, "code", code));
    assertEquals(8, enabled.path("recoveryCodes").size());
    assertEquals(401, send(token, "GET", "/api/auth/me", null, null).status());
    var missing =
        send(null, "POST", "/api/auth/login", map("email", email, "password", password), null);
    assertEquals("MFA_REQUIRED", missing.body().path("code").asText());
    fails(401, null, "/auth/login", map("email", email, "password", password, "code", code));
    String recovery = enabled.path("recoveryCodes").get(0).asText();
    String logged =
        post(null, "/auth/login", map("email", email, "password", password, "code", recovery))
            .path("accessToken")
            .asText();
    fails(401, null, "/auth/login", map("email", email, "password", password, "code", recovery));
    assertEquals(
        7, ok(logged, "GET", "/api/auth/security", null).path("recoveryCodesRemaining").asInt());
    post(
        logged,
        "/auth/password",
        map(
            "password",
            password,
            "newPassword",
            "Changed-Password-2026!",
            "code",
            enabled.path("recoveryCodes").get(1).asText()));
    assertEquals(401, send(logged, "GET", "/api/auth/me", null, null).status());
    String last =
        post(
                null,
                "/auth/login",
                map(
                    "email",
                    email,
                    "password",
                    "Changed-Password-2026!",
                    "code",
                    enabled.path("recoveryCodes").get(2).asText()))
            .path("accessToken")
            .asText();
    post(
        last,
        "/auth/mfa/disable",
        map(
            "password",
            "Changed-Password-2026!",
            "code",
            enabled.path("recoveryCodes").get(3).asText()));
    assertEquals(401, send(last, "GET", "/api/auth/me", null, null).status());
    post(null, "/auth/login", map("email", email, "password", "Changed-Password-2026!"));
  }

  @Test
  void expiredEnrollmentCannotEnableAndPasswordsAreRequired() {
    String id = account("MANAGER"), token = login();
    fails(401, token, "/auth/mfa/setup", map("password", "not-the-password"));
    var setup = post(token, "/auth/mfa/setup", map("password", "New-Staff-Password!"));
    db.update(
        "UPDATE staff_account SET mfa_pending_until=now()-interval '1 minute' WHERE id=?",
        UUID.fromString(id));
    fails(
        409,
        token,
        "/auth/mfa/enable",
        map(
            "password",
            "New-Staff-Password!",
            "code",
            Totp.code(setup.path("secret").asText(), Instant.now().getEpochSecond() / 30)));
    fails(403, at, "/auth/mfa/setup", map("password", "New-Staff-Password!"));
  }

  @Test
  void requestLimitsPersistAndResetWithoutStoringRawIdentity() {
    var limiter = new RequestLimits(db, true);
    String identity = "limit-" + UUID.randomUUID();
    limiter.check(identity, 2, 60);
    limiter.check(identity, 2, 60);
    var error = assertThrows(Problem.class, () -> limiter.check(identity, 2, 60));
    assertEquals(429, error.status());
    assertEquals(
        3, db.number("SELECT hits FROM request_limit WHERE bucket=?", Commands.hash(identity)));
    db.update("UPDATE request_limit SET window_start=-1 WHERE bucket=?", Commands.hash(identity));
    limiter.check(identity, 2, 60);
    assertEquals(
        1, db.number("SELECT hits FROM request_limit WHERE bucket=?", Commands.hash(identity)));
  }
}

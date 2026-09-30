package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionTemplate;

class WorkflowTest extends WorkflowSupport {
  @Test
  void authenticationTenantIsolationAndRevocation() {
    fails(401, null, "/auth/login", map("email", "manager@tablekind.test", "password", "wrong"));
    assertEquals(401, send(null, "GET", "/api/sessions/" + sid, null, null).status());
    assertEquals(403, send(at, "GET", "/api/restaurants/" + rid, null, null).status());
    String another = post(staff, "/restaurants", map("name", "Other")).path("id").asText();
    assertEquals(403, send(at, "GET", "/api/restaurants/" + another, null, null).status());
    action(staff, "/guests/" + b + "/revoke");
    assertEquals(401, send(bt, "GET", "/api/sessions/" + sid, null, null).status());
    assertFalse(state().path("session").has("qr_hash"));
  }

  @Test
  void joiningIsIdempotentQrRevokesAndGroupCapsAtTwenty() {
    String key = UUID.randomUUID().toString();
    var body = map("token", join, "nickname", "Third");
    var first = send(null, "POST", "/api/join", body, key);
    var repeat = send(null, "POST", "/api/join", body, key);
    assertEquals(first.body(), repeat.body());
    assertEquals(3, state().path("guests").size());
    for (int i = 4; i <= 20; i++) post(null, "/join", map("token", join, "nickname", "Guest " + i));
    fails(409, null, "/join", map("token", join, "nickname", "Too many"));
    fails(409, staff, "/restaurants/" + rid + "/tables/" + tid + "/sessions", Map.of());
    action(staff, "/qr");
    fails(410, null, "/join", map("token", join, "nickname", "Old link"));
    assertEquals(200, send(at, "GET", "/api/sessions/" + sid, null, null).status());
  }

  @Test
  void serverControlsPricesAttributionAndStatus() {
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
            "",
            "servedTo",
            b,
            "orderedBy",
            b);
    var i = post(at, "/sessions/" + sid + "/orders", body);
    String id = i.path("id").asText();
    assertEquals(a, i.path("ordered_by").asText());
    assertEquals(b, i.path("served_to").asText());
    assertEquals(0, state().path("bill").path("totalBani").asLong());
    fails(
        403,
        at,
        "/sessions/" + sid + "/orders/" + id + "/status",
        rev("status", "ACCEPTED", "reason", ""));
    action(staff, "/orders/" + id + "/status", "status", "ACCEPTED", "reason", "");
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
    for (String status : List.of("PREPARING", "READY", "SERVED"))
      action(staff, "/orders/" + id + "/status", "status", status, "reason", "");
    fails(
        409,
        staff,
        "/sessions/" + sid + "/orders/" + id + "/status",
        rev("status", "ACCEPTED", "reason", ""));
    body.put("priceBani", 1);
    body.put("revision", revision());
    fails(400, at, "/sessions/" + sid + "/orders", body);
  }

  @ParameterizedTest
  @ValueSource(strings = {"EQUAL", "PROPORTION", "QUANTITY", "AMOUNTS"})
  void sharedDebtNeedsConsentAndConservesTotals(String mode) {
    String id = item();
    long av = mode.equals("PROPORTION") ? 3300 : mode.equals("AMOUNTS") ? 3334 : 1;
    long bv = mode.equals("PROPORTION") ? 6700 : mode.equals("AMOUNTS") ? 6667 : 2;
    var p =
        action(
            at,
            "/items/" + id + "/split",
            "mode",
            mode,
            "shares",
            List.of(map("guestId", a, "value", av), map("guestId", b, "value", bv)),
            "totalUnits",
            3,
            "reason",
            "Sharing");
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
    fails(409, bt, "/sessions/" + sid + "/items/" + id + "/takeover", rev());
    action(bt, "/proposals/" + p.path("proposalId").asText() + "/vote", "accept", true);
    assertEquals(10001, due(a) + due(b));
    assertTrue(due(b) > 0);
    if (mode.equals("EQUAL")) assertEquals(1, Math.abs(due(a) - due(b)));
    if (mode.equals("AMOUNTS")) assertEquals(3334, due(a));
  }

  @Test
  void declinedProposalCanBeReplacedAndWithdrawn() {
    String id = item();
    Object[] fields = {
      "mode",
      "EQUAL",
      "shares",
      List.of(map("guestId", a, "value", 1), map("guestId", b, "value", 1)),
      "reason",
      "Share"
    };
    var p = action(at, "/items/" + id + "/split", fields);
    action(bt, "/proposals/" + p.path("proposalId").asText() + "/vote", "accept", false);
    assertEquals(10001, due(a));
    p = action(at, "/items/" + id + "/split", fields);
    action(at, "/proposals/" + p.path("proposalId").asText() + "/withdraw");
    action(bt, "/items/" + id + "/takeover");
    assertEquals(10001, due(b));
    assertEquals(a, state().path("items").get(0).path("ordered_by").asText());
  }

  @Test
  void transferRequiresRecipientAndPreservesOriginalOrderer() {
    String id = item();
    var p = action(at, "/items/" + id + "/transfer", "guestId", b, "reason", "Diego wants it");
    assertEquals(a, state().path("items").get(0).path("served_to").asText());
    action(bt, "/proposals/" + p.path("proposalId").asText() + "/vote", "accept", true);
    var i = state().path("items").get(0);
    assertEquals(b, i.path("served_to").asText());
    assertEquals(a, i.path("ordered_by").asText());
    assertEquals(10001, due(b));
  }

  @Test
  void wholeBillSplitAndAdjustmentsKeepEveryBan() {
    item();
    item();
    var p = action(at, "/split-equally", "guestIds", List.of(a, b));
    action(bt, "/proposals/" + p.path("proposalId").asText() + "/vote", "accept", true);
    assertEquals(10001, due(a));
    action(staff, "/adjustments", "kind", "DISCOUNT", "basisPoints", 1000, "reason", "Ten percent");
    assertEquals(18002, state().path("bill").path("totalBani").asLong());
    assertEquals(18002, due(a) + due(b));
    action(
        staff,
        "/adjustments",
        "kind",
        "SERVICE_CHARGE",
        "amountBani",
        1,
        "reason",
        "Rounding example");
    assertEquals(18003, due(a) + due(b));
    fails(
        400,
        staff,
        "/sessions/" + sid + "/adjustments",
        rev("kind", "DISCOUNT", "amountBani", 999999, "reason", "Too much"));
    fails(
        403,
        at,
        "/sessions/" + sid + "/adjustments",
        rev("kind", "TAX", "amountBani", 1, "reason", "Unauthorized"));
  }

  @Test
  void quotesHoldsRetriesAndExpiryNeverCollectMoney() {
    String id = item();
    var quote =
        action(at, "/checkout/quote", "target", "SELF", "guestIds", List.of(), "amountBani", 2000);
    assertEquals(2000, quote.path("amountBani").asLong());
    assertEquals(0, state().path("reservations").size());
    var body = rev("target", "REMAINDER", "guestIds", List.of(), "amountBani", 2000);
    String key = UUID.randomUUID().toString();
    String path = "/api/sessions/" + sid + "/checkout/reservations";
    var first = send(bt, "POST", path, body, key);
    assertEquals(200, first.status(), first.body().toString());
    assertEquals(first.body(), send(bt, "POST", path, body, key).body());
    assertEquals(1, state().path("reservations").size());
    assertEquals(0, state().path("bill").path("paidBani").asLong());
    body.put("amountBani", 1000);
    assertEquals(409, send(bt, "POST", path, body, key).status());
    fails(409, at, "/sessions/" + sid + "/items/" + id + "/takeover", rev());
    String hold = first.body().path("reservationId").asText();
    fails(403, at, "/sessions/" + sid + "/checkout/reservations/" + hold + "/release", rev());
    action(bt, "/checkout/reservations/" + hold + "/release");
    action(bt, "/items/" + id + "/takeover");
    action(bt, "/checkout/reservations", "target", "SELF", "guestIds", List.of());
    db.update(
        "UPDATE checkout_reservation SET expires_at=now()-interval '1 second' WHERE session_id=?",
        UUID.fromString(sid));
    assertEquals(0, state().path("bill").path("reservedBani").asLong());
    action(at, "/items/" + id + "/takeover");
  }

  @Test
  void staleRevisionIsRejectedWithoutChangingBill() {
    String id = item();
    fails(409, bt, "/sessions/" + sid + "/items/" + id + "/takeover", map("revision", 0));
    assertEquals(10001, due(a));
  }

  @Test
  void unavailableAndUnknownOptionsAreRejected() {
    fails(
        400,
        at,
        "/sessions/" + sid + "/orders",
        rev(
            "productId",
            pid,
            "productVersion",
            1,
            "quantity",
            1,
            "optionIds",
            List.of(UUID.randomUUID()),
            "note",
            ""));
    ok(
        staff,
        "PUT",
        "/api/restaurants/" + rid + "/products/" + pid + "/availability",
        map("available", false));
    fails(
        409,
        at,
        "/sessions/" + sid + "/orders",
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
            ""));
    assertEquals(0, state().path("items").size());
  }

  @Test
  void cancellingAppendsReversalsAndAllowsClosure() {
    String id = item();
    fails(409, staff, "/sessions/" + sid + "/close", rev());
    action(
        staff,
        "/orders/" + id + "/status",
        "status",
        "CANCELLED",
        "reason",
        "Customer changed mind");
    assertEquals(0, due(a));
    assertEquals(2, state().path("items").get(0).path("adjustments").size());
    action(staff, "/close");
    assertEquals("CLOSED", state().path("session").path("status").asText());
  }

  @Test
  void assistanceRequiresStaffCompletion() {
    String help = action(at, "/help", "reason", "Cutlery please").path("id").asText();
    fails(403, at, "/sessions/" + sid + "/help/" + help + "/complete", rev());
    fails(409, staff, "/sessions/" + sid + "/close", rev());
    action(staff, "/help/" + help + "/complete");
    action(staff, "/close");
  }

  @Test
  void databaseRejectsHistoryEditsAndUnbalancedEntries() {
    String id = item();
    assertThrows(
        Exception.class,
        () ->
            db.update("UPDATE bill_entry SET amount_bani=1 WHERE item_id=?", UUID.fromString(id)));
    assertThrows(
        Exception.class,
        () ->
            new TransactionTemplate(tx)
                .execute(
                    status -> {
                      db.update(
                          "INSERT INTO"
                              + " bill_entry(id,restaurant_id,session_id,item_id,amount_bani,kind,reason,batch_id)"
                              + " VALUES(?,?,?,?,1,'CORRECTION','Unbalanced',?)",
                          UUID.randomUUID(),
                          UUID.fromString(rid),
                          UUID.fromString(sid),
                          UUID.fromString(id),
                          UUID.randomUUID());
                      return null;
                    }));
    assertEquals(10001, state().path("bill").path("totalBani").asLong());
  }

  @Test
  void modifierRequirementsAndPricesComeFromTheMenu() {
    ok(
        staff,
        "PUT",
        "/api/restaurants/" + rid + "/products/" + pid + "/modifiers",
        map(
            "groups",
            List.of(
                map(
                    "names",
                    map("en", "Size"),
                    "minSelect",
                    1,
                    "maxSelect",
                    1,
                    "options",
                    List.of(
                        map("names", map("en", "Large"), "priceBani", 1000, "available", true))))));
    var product = state().path("menu").path("products").get(0);
    String option =
        product.path("modifierGroups").get(0).path("options").get(0).path("id").asText();
    fails(
        400,
        at,
        "/sessions/" + sid + "/orders",
        rev(
            "productId",
            pid,
            "productVersion",
            2,
            "quantity",
            1,
            "optionIds",
            List.of(),
            "note",
            ""));
    var order =
        action(
            at,
            "/orders",
            "productId",
            pid,
            "productVersion",
            2,
            "quantity",
            2,
            "optionIds",
            List.of(option),
            "note",
            "");
    assertEquals(11001, order.path("unit_price_bani").asLong());
    action(
        staff,
        "/orders/" + order.path("id").asText() + "/status",
        "status",
        "ACCEPTED",
        "reason",
        "");
    assertEquals(22002, due(a));
  }

  @Test
  void branchPauseAndAutomaticApprovalWork() {
    var settings =
        map(
            "name",
            "Branch",
            "timezone",
            "Europe/Chisinau",
            "approvalRequired",
            false,
            "acceptingOrders",
            false,
            "hours",
            List.of());
    String path = "/api/restaurants/" + rid + "/branches/" + bid;
    ok(staff, "PUT", path, settings);
    fails(
        409,
        at,
        "/sessions/" + sid + "/orders",
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
            ""));
    settings.put("acceptingOrders", true);
    ok(staff, "PUT", path, settings);
    var order =
        action(
            at,
            "/orders",
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
    assertEquals("ACCEPTED", order.path("status").asText());
    assertEquals(10001, due(a));
  }

  @Test
  void waiterPermissionsAndRevokedIdempotentReplay() {
    String email = UUID.randomUUID() + "@test.local";
    String waiterId =
        post(
                staff,
                "/restaurants/" + rid + "/staff",
                map(
                    "email",
                    email,
                    "displayName",
                    "Waiter",
                    "password",
                    "Local-Staff-2026!",
                    "role",
                    "WAITER"))
            .path("id")
            .asText();
    String waiter =
        post(null, "/auth/login", map("email", email, "password", "Local-Staff-2026!"))
            .path("accessToken")
            .asText();
    fails(
        403,
        waiter,
        "/restaurants/" + rid + "/categories",
        map("names", map("en", "Denied"), "sortOrder", 0));
    String another = post(staff, "/restaurants", map("name", "Other tenant")).path("id").asText();
    assertEquals(403, send(waiter, "GET", "/api/restaurants/" + another, null, null).status());
    String key = UUID.randomUUID().toString(),
        path = "/api/restaurants/" + rid + "/products/" + pid + "/availability";
    var body = map("available", false);
    assertEquals(200, send(waiter, "PUT", path, body, key).status());
    ok(staff, "DELETE", "/api/restaurants/" + rid + "/staff/" + waiterId, null);
    assertEquals(403, send(waiter, "PUT", path, body, key).status());
  }

  @Test
  void settlementExtensionProtectsPaidItems() {
    String id = item();
    db.update(
        "INSERT INTO"
            + " settlement_entry(id,restaurant_id,session_id,item_id,guest_id,amount_bani,external_reference)"
            + " VALUES(?,?,?,?,?,100,'test-fixture-only')",
        UUID.randomUUID(),
        UUID.fromString(rid),
        UUID.fromString(sid),
        UUID.fromString(id),
        UUID.fromString(a));
    fails(409, bt, "/sessions/" + sid + "/items/" + id + "/takeover", rev());
    assertEquals(9901, state().path("bill").path("remainingBani").asLong());
    assertEquals(10001, due(a));
    assertThrows(
        Exception.class,
        () -> db.update("DELETE FROM settlement_entry WHERE session_id=?", UUID.fromString(sid)));
  }

  @Test
  void requestValidationAndOpenApiRemainAvailable() {
    assertEquals(
        400, send(staff, "POST", "/api/restaurants", map("name", "Missing key"), null).status());
    assertEquals(200, send(null, "GET", "/v3/api-docs", null, null).status());
    assertEquals(404, send(staff, "GET", "/api/does-not-exist", null, null).status());
  }

  @Test
  void simultaneousCheckoutCannotReserveTheSameRemainderTwice() throws Exception {
    Assumptions.assumeFalse(
        SUPPLEMENTARY,
        "Native PostgreSQL concurrency requires multiple independent database connections.");
    item();
    var body = rev("target", "REMAINDER", "guestIds", List.of());
    String path = "/api/sessions/" + sid + "/checkout/reservations";
    try (var executor = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      var one =
          executor.submit(
              () -> {
                start.await();
                return send(at, "POST", path, body, UUID.randomUUID().toString()).status();
              });
      var two =
          executor.submit(
              () -> {
                start.await();
                return send(bt, "POST", path, body, UUID.randomUUID().toString()).status();
              });
      start.countDown();
      var statuses = new ArrayList<>(List.of(one.get(), two.get()));
      Collections.sort(statuses);
      assertEquals(List.of(200, 409), statuses);
    }
    assertEquals(10001, state().path("bill").path("reservedBani").asLong());
  }
}

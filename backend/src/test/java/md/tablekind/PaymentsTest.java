package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import md.tablekind.payments.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

class PaymentsTest extends WorkflowSupport {
  @Autowired LocalTestProvider provider;

  String pay(String token, String method, Long amount, long tip) {
    return action(
            token,
            "/payments",
            "target",
            "SELF",
            "guestIds",
            List.of(),
            "payerId",
            null,
            "amountBani",
            amount,
            "method",
            method,
            "tipBani",
            tip)
        .path("id")
        .asText();
  }

  JsonNode outcome(String id, String kind, String status, boolean deliver) {
    return action(
        staff,
        "/payments/" + id + "/test-result",
        "kind",
        kind,
        "outcome",
        status,
        "deliver",
        deliver);
  }

  JsonNode p(String id) {
    for (var p : state().path("payments")) if (id.equals(p.path("id").asText())) return p;
    throw new AssertionError();
  }

  long bill(String key) {
    return state().path("bill").path(key).asLong();
  }

  void cash(String id, long received) {
    action(
        staff,
        "/payments/" + id + "/confirm",
        "receivedBani",
        received,
        "reference",
        "",
        "collected",
        true);
  }

  String refund(String id, long amount, long tip, String mode) {
    return action(
            staff,
            "/payments/" + id + "/refunds",
            "amountBani",
            amount,
            "tipBani",
            tip,
            "mode",
            mode,
            "reason",
            "Customer request")
        .path("id")
        .asText();
  }

  void returnCash(String id) {
    action(staff, "/refunds/" + id + "/confirm", "reference", "", "returned", true);
  }

  Reply webhook(byte[] body, String timestamp, String signature) throws Exception {
    var response =
        http.send(
            HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:" + port + "/api/payment-webhooks/local-test"))
                .header("Content-Type", "application/json")
                .header("X-Payment-Timestamp", timestamp)
                .header("X-Payment-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    return new Reply(response.statusCode(), json.readTree(response.body()));
  }

  Reply webhook(LocalTestProvider.Envelope e) throws Exception {
    return webhook(e.body(), e.timestamp(), e.signature());
  }

  @ParameterizedTest
  @ValueSource(strings = {"CARD", "MIA"})
  void onlineSuccessSettlesOnlyBillAndTracksTipSeparately(String method) {
    item();
    String id = pay(at, method, null, 999);
    assertEquals(0, bill("paidBani"));
    assertEquals(10001, bill("reservedBani"));
    assertEquals(11000, provider.lookup(UUID.fromString(id)).amountBani());
    outcome(id, "PAYMENT", "SUCCEEDED", true);
    assertEquals("SUCCEEDED", p(id).path("status").asText());
    assertEquals(10001, bill("paidBani"));
    assertEquals(0, bill("remainingBani"));
    assertEquals(0, bill("reservedBani"));
    var report = ok(staff, "GET", "/api/sessions/" + sid + "/payments/reconciliation", null);
    assertTrue(report.path("balanced").asBoolean());
    assertEquals(999, report.path("netTipsBani").asLong());
    assertTrue(
        ok(at, "GET", "/api/sessions/" + sid + "/payments/" + id + "/confirmation", null)
            .path("title")
            .asText()
            .startsWith("TEST"));
    assertEquals(
        403,
        send(bt, "GET", "/api/sessions/" + sid + "/payments/" + id + "/confirmation", null, null)
            .status());
  }

  @ParameterizedTest
  @ValueSource(strings = {"FAILED", "CANCELLED", "EXPIRED"})
  void providerFailureReleasesExactSharesAndAllowsNewAttempt(String status) {
    item();
    String id = pay(at, "CARD", null, 0);
    outcome(id, "PAYMENT", status, true);
    assertEquals(status, p(id).path("status").asText());
    assertEquals(0, bill("paidBani"));
    assertEquals(10001, bill("availableBani"));
    String next = pay(at, "MIA", null, 0);
    outcome(next, "PAYMENT", "SUCCEEDED", true);
    assertEquals(10001, bill("paidBani"));
  }

  @Test
  void missingNotificationAndElapsedHoldCannotCauseDoubleCollection() {
    String item = item(), id = pay(at, "CARD", null, 0);
    outcome(id, "PAYMENT", "SUCCEEDED", false);
    db.update(
        "UPDATE checkout_reservation SET expires_at=now()-interval '1 day' WHERE id=?",
        UUID.fromString(p(id).path("reservation_id").asText()));
    assertEquals("PENDING", p(id).path("status").asText());
    assertEquals(10001, bill("reservedBani"));
    fails(
        400,
        at,
        "/sessions/" + sid + "/payments",
        rev("target", "SELF", "guestIds", List.of(), "method", "CASH", "tipBani", 0));
    fails(
        409,
        staff,
        "/sessions/" + sid + "/orders/" + item + "/status",
        rev("status", "CANCELLED", "reason", "Changed mind"));
    fails(
        409,
        at,
        "/sessions/"
            + sid
            + "/checkout/reservations/"
            + p(id).path("reservation_id").asText()
            + "/release",
        rev());
    action(at, "/payments/" + id + "/reconcile");
    assertEquals(10001, bill("paidBani"));
    action(at, "/payments/" + id + "/reconcile");
    assertEquals(
        1,
        db.number("SELECT count(*) FROM settlement_entry WHERE payment_id=?", UUID.fromString(id)));
  }

  @Test
  void cancelChecksProviderSuccessBeforeReleasingAnything() {
    item();
    String id = pay(at, "CARD", null, 0);
    outcome(id, "PAYMENT", "SUCCEEDED", false);
    action(at, "/payments/" + id + "/cancel");
    assertEquals("SUCCEEDED", p(id).path("status").asText());
    assertEquals(10001, bill("paidBani"));
  }

  @Test
  void truePendingCancellationReleasesWithoutSettlement() {
    item();
    String id = pay(at, "MIA", null, 0);
    action(at, "/payments/" + id + "/cancel");
    assertEquals("CANCELLED", p(id).path("status").asText());
    assertEquals(10001, bill("availableBani"));
    fails(
        409,
        staff,
        "/sessions/" + sid + "/payments/" + id + "/test-result",
        rev("kind", "PAYMENT", "outcome", "SUCCEEDED", "deliver", true));
  }

  @Test
  void mixedCashTerminalAndOnlinePartialPaymentsReconcile() {
    item();
    String first = pay(at, "CASH", 3000L, 200);
    fails(
        403,
        at,
        "/sessions/" + sid + "/payments/" + first + "/confirm",
        rev("receivedBani", 4000, "reference", "", "collected", true));
    fails(403, at, "/sessions/" + sid + "/payments/" + first + "/cancel", rev());
    fails(
        400,
        staff,
        "/sessions/" + sid + "/payments/" + first + "/confirm",
        rev("receivedBani", 3000, "reference", "", "collected", true));
    cash(first, 4000);
    assertEquals(800, p(first).path("change_bani").asLong());
    String second = pay(at, "TERMINAL", 2000L, 0);
    fails(
        400,
        staff,
        "/sessions/" + sid + "/payments/" + second + "/confirm",
        rev("reference", "", "collected", true));
    action(
        staff,
        "/payments/" + second + "/confirm",
        "reference",
        "TERM-" + UUID.randomUUID(),
        "collected",
        true);
    String third = pay(at, "CARD", null, 0);
    outcome(third, "PAYMENT", "SUCCEEDED", true);
    assertEquals(10001, bill("paidBani"));
    assertEquals(0, bill("remainingBani"));
    assertEquals(
        200,
        ok(staff, "GET", "/api/sessions/" + sid + "/payments/reconciliation", null)
            .path("netTipsBani")
            .asLong());
  }

  @Test
  void paymentRequestReplayIsIdempotentAndBodyMismatchConflicts() {
    item();
    String key = UUID.randomUUID().toString(), path = "/api/sessions/" + sid + "/payments";
    var body = rev("target", "SELF", "guestIds", List.of(), "method", "CARD", "tipBani", 0);
    var first = send(at, "POST", path, body, key);
    assertEquals(200, first.status(), first.body().toString());
    assertEquals(first.body(), send(at, "POST", path, body, key).body());
    assertEquals(1, state().path("payments").size());
    body.put("method", "CASH");
    assertEquals(409, send(at, "POST", path, body, key).status());
  }

  @Test
  void signedWebhooksAreDeduplicatedAndOutOfOrderIsHarmless() throws Exception {
    item();
    String id = pay(at, "CARD", null, 0);
    var stale = provider.notification(UUID.fromString(id));
    outcome(id, "PAYMENT", "SUCCEEDED", false);
    var current = provider.notification(UUID.fromString(id));
    assertEquals(200, webhook(current).status());
    assertTrue(webhook(current).body().path("duplicate").asBoolean());
    assertEquals(200, webhook(stale).status());
    assertEquals("SUCCEEDED", p(id).path("status").asText());
    assertEquals(
        1,
        db.number("SELECT count(*) FROM settlement_entry WHERE payment_id=?", UUID.fromString(id)));
    var altered = json.readTree(current.body()).deepCopy();
    ((com.fasterxml.jackson.databind.node.ObjectNode) altered).put("status", "FAILED");
    byte[] raw = json.writeValueAsBytes(altered);
    assertEquals(
        409, webhook(raw, current.timestamp(), provider.sign(raw, current.timestamp())).status());
  }

  @Test
  void invalidSignaturesStaleTimestampsAndWrongMerchantAmountsDoNotSettle() throws Exception {
    item();
    String id = pay(at, "CARD", null, 0);
    outcome(id, "PAYMENT", "SUCCEEDED", false);
    var valid = provider.notification(UUID.fromString(id));
    assertEquals(401, webhook(valid.body(), valid.timestamp(), "0".repeat(64)).status());
    String old = Long.toString(Instant.now().minusSeconds(600).getEpochSecond());
    assertEquals(401, webhook(valid.body(), old, provider.sign(valid.body(), old)).status());
    for (String field : List.of("restaurantId", "amountBani", "currency")) {
      var data = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(valid.body());
      data.put("eventId", UUID.randomUUID().toString());
      if (field.equals("amountBani")) data.put(field, 1);
      else data.put(field, field.equals("currency") ? "EUR" : UUID.randomUUID().toString());
      byte[] raw = json.writeValueAsBytes(data);
      assertEquals(
          field.equals("currency") ? 401 : 409,
          webhook(raw, valid.timestamp(), provider.sign(raw, valid.timestamp())).status());
    }
    assertEquals(0, bill("paidBani"));
    assertEquals(10001, bill("reservedBani"));
  }

  @Test
  void guestsCannotManipulateAnotherPayerOrForgeStaffConfirmation() {
    item();
    String id = pay(at, "CARD", null, 0);
    fails(403, bt, "/sessions/" + sid + "/payments/" + id + "/cancel", rev());
    fails(
        403,
        bt,
        "/sessions/" + sid + "/payments/" + id + "/test-result",
        rev("kind", "PAYMENT", "outcome", "SUCCEEDED", "deliver", true));
    fails(400, staff, "/sessions/" + sid + "/payments/" + id + "/confirm", rev("collected", true));
    assertEquals(
        403,
        send(at, "GET", "/api/sessions/" + sid + "/payments/reconciliation", null, null).status());
  }

  @Test
  void payingForSomeoneElseKeepsOriginalItemOwnership() {
    String item = item();
    String id =
        action(
                bt,
                "/payments",
                "target",
                "GUESTS",
                "guestIds",
                List.of(a),
                "method",
                "CASH",
                "tipBani",
                0)
            .path("id")
            .asText();
    cash(id, 10001);
    assertEquals(b, p(id).path("payer_id").asText());
    assertEquals(a, p(id).path("parts").get(0).path("guest_id").asText());
    assertEquals(10001, bill("paidBani"));
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
    assertEquals(a, state().path("items").get(0).path("ordered_by").asText());
  }

  @Test
  void sharedItemRefundPreservesExactOriginalPortions() {
    String item = item();
    action(
        at,
        "/items/" + item + "/split",
        "mode",
        "EQUAL",
        "shares",
        List.of(map("guestId", a, "value", 1), map("guestId", b, "value", 1)),
        "reason",
        "Shared");
    String proposal = state().path("proposals").get(0).path("id").asText();
    action(bt, "/proposals/" + proposal + "/vote", "accept", true);
    long beforeA = due(a), beforeB = due(b);
    String id =
        action(
                at,
                "/payments",
                "target",
                "REMAINDER",
                "guestIds",
                List.of(),
                "method",
                "CARD",
                "tipBani",
                501)
            .path("id")
            .asText();
    outcome(id, "PAYMENT", "SUCCEEDED", true);
    String ref = refund(id, 3333, 201, "REDUCE_BILL");
    assertEquals(10001, bill("totalBani"));
    outcome(ref, "REFUND", "SUCCEEDED", true);
    assertEquals(6668, bill("totalBani"));
    assertEquals(6668, bill("paidBani"));
    assertEquals(0, bill("remainingBani"));
    assertEquals(3333, beforeA + beforeB - due(a) - due(b));
    for (var part : db.list("SELECT * FROM refund_part WHERE refund_id=?", UUID.fromString(ref)))
      assertEquals(
          -((Number) part.get("amount_bani")).longValue(),
          db.number(
              "SELECT sum(amount_bani) FROM settlement_entry WHERE refund_id=? AND guest_id=?",
              UUID.fromString(ref),
              part.get("guest_id")));
    assertEquals(
        300,
        ok(staff, "GET", "/api/sessions/" + sid + "/payments/reconciliation", null)
            .path("netTipsBani")
            .asLong());
  }

  @Test
  void refundCapacityIncludesPendingAndFailedRefundCanBeRetried() {
    item();
    String id = pay(at, "CARD", null, 0);
    outcome(id, "PAYMENT", "SUCCEEDED", true);
    String ref = refund(id, 9000, 0, "REDUCE_BILL");
    fails(
        409,
        staff,
        "/sessions/" + sid + "/payments/" + id + "/refunds",
        rev("amountBani", 1002, "tipBani", 0, "mode", "REDUCE_BILL", "reason", "Too much"));
    outcome(ref, "REFUND", "FAILED", true);
    String next = refund(id, 10001, 0, "REDUCE_BILL");
    outcome(next, "REFUND", "SUCCEEDED", true);
    assertEquals(0, bill("totalBani"));
    assertEquals(0, bill("paidBani"));
  }

  @Test
  void returnedPaymentReopensAmountDueButChargeReductionDoesNot() {
    item();
    String id = pay(at, "CASH", null, 0);
    cash(id, 10001);
    String ref = refund(id, 3000, 0, "RETURN_PAYMENT");
    returnCash(ref);
    assertEquals(10001, bill("totalBani"));
    assertEquals(3000, bill("remainingBani"));
    String next = pay(at, "MIA", null, 0);
    outcome(next, "PAYMENT", "SUCCEEDED", true);
    assertEquals(0, bill("remainingBani"));
  }

  @Test
  void fullySettledServedTableClosesAndCanReceiveChargeReducingRefund() {
    String item = item();
    String id = pay(at, "CASH", null, 500);
    cash(id, 11000);
    for (String status : List.of("PREPARING", "READY", "SERVED"))
      action(staff, "/orders/" + item + "/status", "status", status, "reason", "");
    action(staff, "/close");
    fails(
        409,
        staff,
        "/sessions/" + sid + "/payments/" + id + "/refunds",
        rev("amountBani", 1, "tipBani", 0, "mode", "RETURN_PAYMENT", "reason", "Not allowed"));
    String ref = refund(id, 10001, 500, "REDUCE_BILL");
    returnCash(ref);
    assertEquals("CLOSED", state().path("session").path("status").asText());
    assertEquals(0, bill("remainingBani"));
    assertEquals(0, bill("totalBani"));
  }

  @Test
  void tipOnlyRefundDoesNotChangeTheBill() {
    item();
    String id = pay(at, "CARD", null, 500);
    outcome(id, "PAYMENT", "SUCCEEDED", true);
    String ref = refund(id, 0, 500, "REDUCE_BILL");
    outcome(ref, "REFUND", "SUCCEEDED", true);
    assertEquals(10001, bill("totalBani"));
    assertEquals(10001, bill("paidBani"));
    assertEquals(
        0,
        ok(staff, "GET", "/api/sessions/" + sid + "/payments/reconciliation", null)
            .path("netTipsBani")
            .asLong());
  }

  @Test
  void refundRequiresManagerAndActualReturnConfirmation() {
    item();
    String id = pay(at, "CASH", null, 0);
    cash(id, 10001);
    fails(
        403,
        at,
        "/sessions/" + sid + "/payments/" + id + "/refunds",
        rev("amountBani", 100, "tipBani", 0, "mode", "REDUCE_BILL", "reason", "No authority"));
    String email = "waiter-" + UUID.randomUUID() + "@tablekind.local";
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
            "WAITER"));
    String waiter =
        post(null, "/auth/login", map("email", email, "password", "Local-Staff-2026!"))
            .path("accessToken")
            .asText();
    fails(
        403,
        waiter,
        "/sessions/" + sid + "/payments/" + id + "/refunds",
        rev("amountBani", 100, "tipBani", 0, "mode", "REDUCE_BILL", "reason", "No authority"));
    String ref = refund(id, 100, 0, "REDUCE_BILL");
    fails(
        403,
        waiter,
        "/sessions/" + sid + "/refunds/" + ref + "/confirm",
        rev("reference", "", "returned", true));
    fails(
        400,
        staff,
        "/sessions/" + sid + "/refunds/" + ref + "/confirm",
        rev("reference", "", "returned", false));
    returnCash(ref);
    assertEquals(9901, bill("paidBani"));
  }

  @Test
  void concurrentAttemptsCannotReserveSameSharesTwice() throws Exception {
    Assumptions.assumeFalse(SUPPLEMENTARY, "Requires native PostgreSQL concurrent connections");
    item();
    long revision = revision();
    var body =
        map(
            "revision",
            revision,
            "target",
            "REMAINDER",
            "guestIds",
            List.of(),
            "method",
            "CARD",
            "tipBani",
            0);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var gate = new CountDownLatch(1);
      var first =
          executor.submit(
              () -> {
                gate.await();
                return send(
                    at,
                    "POST",
                    "/api/sessions/" + sid + "/payments",
                    body,
                    UUID.randomUUID().toString());
              });
      var second =
          executor.submit(
              () -> {
                gate.await();
                return send(
                    bt,
                    "POST",
                    "/api/sessions/" + sid + "/payments",
                    body,
                    UUID.randomUUID().toString());
              });
      gate.countDown();
      var statuses = new ArrayList<>(List.of(first.get().status(), second.get().status()));
      Collections.sort(statuses);
      assertEquals(List.of(200, 409), statuses);
    }
    assertEquals(10001, bill("reservedBani"));
    assertEquals(1, state().path("payments").size());
  }
}

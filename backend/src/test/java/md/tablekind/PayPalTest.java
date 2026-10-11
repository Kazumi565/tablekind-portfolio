package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.util.concurrent.*;
import md.tablekind.auth.Actor;
import md.tablekind.common.Db;
import md.tablekind.paypal.*;
import md.tablekind.restaurant.CatalogService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.*;

@TestPropertySource(
    properties = {
      "tablekind.paypal.enabled=true",
      "tablekind.paypal.client-id=fixture-client",
      "tablekind.paypal.client-secret=fixture-secret",
      "tablekind.paypal.merchant-id=MERCHANT123",
      "tablekind.paypal.worker-enabled=false"
    })
class PayPalTest extends WorkflowSupport {
  @Autowired CatalogService catalog;
  @Autowired PayPalPayments paypal;
  @MockitoBean PayPalGateway gateway;

  @Override
  @SuppressWarnings("unchecked")
  String createFixtureRestaurant() {
    return new TransactionTemplate(tx)
        .execute(
            t -> {
              var actor =
                  new Actor(
                      Db.id(
                          db.one(
                              "SELECT id FROM staff_account WHERE email='manager@tablekind.test'"),
                          "id"),
                      "STAFF",
                      0);
              var r = (Map<String, Object>) catalog.create(actor, "EUR fixture", "EUR");
              db.update(
                  "INSERT INTO paypal_merchant(restaurant_id,merchant_id) VALUES(?,'MERCHANT123')",
                  r.get("id"));
              return r.get("id").toString();
            });
  }

  UUID start() {
    item();
    return UUID.fromString(action(at, "/paypal", "tipMinor", 99).path("paymentId").asText());
  }

  ObjectNode order(UUID id, String status, String capture) {
    var unit =
        map(
            "custom_id",
            id.toString(),
            "payee",
            map("merchant_id", "MERCHANT123"),
            "amount",
            map("currency_code", "EUR", "value", "101.00"));
    if (capture != null)
      unit.put(
          "payments",
          map(
              "captures",
              List.of(
                  map(
                      "id",
                      "CAPTURE" + id.toString().replace("-", ""),
                      "status",
                      capture,
                      "amount",
                      map("currency_code", "EUR", "value", "101.00")))));
    return json.valueToTree(
        map(
            "id",
            "ORDER" + id.toString().replace("-", ""),
            "intent",
            "CAPTURE",
            "status",
            status,
            "purchase_units",
            List.of(unit),
            "links",
            List.of(
                map(
                    "rel",
                    "payer-action",
                    "href",
                    "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123"))));
  }

  void ready(UUID id) {
    when(gateway.create(any(), any()))
        .thenAnswer(
            call -> {
              assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
              assertEquals(
                  10001, db.number("SELECT amount_bani FROM payment_attempt WHERE id=?", id));
              return order(id, "PAYER_ACTION_REQUIRED", null);
            });
    paypal.process(id);
    assertEquals("APPROVAL", phase(id));
  }

  String phase(UUID id) {
    return Db.text(db.one("SELECT phase FROM paypal_checkout WHERE payment_id=?", id), "phase");
  }

  long paid() {
    return state().path("bill").path("paidBani").asLong();
  }

  void due(UUID id) {
    db.update(
        "UPDATE paypal_checkout SET next_attempt_at=now(),lease_until=NULL WHERE payment_id=?", id);
  }

  @Test
  void exactReservationAndTipSettleOnceOnlyAfterVerifiedCapture() {
    UUID id = start();
    ready(id);
    assertEquals(0, paid());
    assertEquals("EUR", state().path("currency").asText());
    when(gateway.lookup(any())).thenReturn(order(id, "APPROVED", null));
    when(gateway.capture(any(), any())).thenReturn(order(id, "COMPLETED", "COMPLETED"));
    action(at, "/paypal/" + id + "/approve");
    paypal.process(id);
    paypal.process(id);
    assertEquals(10001, paid());
    assertEquals("RESOLVED", phase(id));
    assertEquals(1, db.number("SELECT count(*) FROM settlement_entry WHERE payment_id=?", id));
    assertEquals(99, db.number("SELECT tip_bani FROM payment_attempt WHERE id=?", id));
    verify(gateway, times(1)).capture(any(), any());
  }

  @Test
  void repeatedBrowserStartReturnsSameAttemptAndChangedBodyConflicts() {
    item();
    String key = UUID.randomUUID().toString();
    var body = rev("tipMinor", 0);
    var first = send(at, "POST", "/api/sessions/" + sid + "/paypal", body, key);
    assertEquals(200, first.status());
    assertEquals(
        first.body(), send(at, "POST", "/api/sessions/" + sid + "/paypal", body, key).body());
    body.put("tipMinor", 1);
    assertEquals(409, send(at, "POST", "/api/sessions/" + sid + "/paypal", body, key).status());
    assertEquals(
        1,
        db.number("SELECT count(*) FROM payment_attempt WHERE session_id=?", UUID.fromString(sid)));
  }

  @Test
  void lostCreateResponseRetriesOriginalRequestAfterRestartLease() {
    UUID id = start();
    when(gateway.create(any(), any()))
        .thenThrow(new IllegalStateException("response lost"))
        .thenReturn(order(id, "CREATED", null));
    paypal.process(id);
    assertEquals(0, paid());
    assertEquals("CREATE", phase(id));
    db.update(
        "UPDATE paypal_checkout SET lease_token=?,lease_until=now()-interval '1"
            + " minute',next_attempt_at=now() WHERE payment_id=?",
        UUID.randomUUID(),
        id);
    paypal.process(id);
    assertEquals("APPROVAL", phase(id));
    var keys = org.mockito.ArgumentCaptor.forClass(UUID.class);
    verify(gateway, times(2)).create(any(), keys.capture());
    assertEquals(keys.getAllValues().get(0), keys.getAllValues().get(1));
  }

  @Test
  void lostCaptureResponseRecoversFromProviderWithoutSecondCapture() {
    UUID id = start();
    ready(id);
    when(gateway.lookup(any()))
        .thenReturn(order(id, "APPROVED", null), order(id, "COMPLETED", "COMPLETED"));
    when(gateway.capture(any(), any())).thenThrow(new IllegalStateException("lost response"));
    action(at, "/paypal/" + id + "/approve");
    paypal.process(id);
    assertEquals(0, paid());
    due(id);
    paypal.process(id);
    assertEquals(10001, paid());
    verify(gateway, times(1)).capture(any(), any());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"merchant", "currency", "amount", "order", "capture-amount", "relationship"})
  void mismatchedProviderDetailsNeverSettle(String kind) {
    UUID id = start();
    ready(id);
    var result = order(id, "COMPLETED", "COMPLETED");
    var u = (ObjectNode) result.path("purchase_units").get(0);
    switch (kind) {
      case "merchant" -> ((ObjectNode) u.path("payee")).put("merchant_id", "WRONG");
      case "currency" -> ((ObjectNode) u.path("amount")).put("currency_code", "MDL");
      case "amount" -> ((ObjectNode) u.path("amount")).put("value", "100.99");
      case "order" -> result.put("id", "WRONG123");
      case "relationship" -> u.put("custom_id", UUID.randomUUID().toString());
      default ->
          ((ObjectNode) u.path("payments").path("captures").get(0).path("amount"))
              .put("value", "99.99");
    }
    when(gateway.lookup(any())).thenReturn(result);
    action(at, "/paypal/" + id + "/approve");
    paypal.process(id);
    assertEquals("REVIEW", phase(id));
    assertEquals(0, paid());
    assertEquals(10001, state().path("bill").path("reservedBani").asLong());
  }

  @Test
  void cancellationBeforeCaptureFencesDelayedApproval() {
    UUID id = start();
    ready(id);
    action(at, "/paypal/" + id + "/cancel");
    action(at, "/paypal/" + id + "/approve");
    paypal.process(id);
    assertEquals(0, paid());
    assertEquals(0, state().path("bill").path("reservedBani").asLong());
    verify(gateway, never()).capture(any(), any());
  }

  @Test
  void cancellationDuringCapturePreservesReservationUntilRecovery() throws Exception {
    UUID id = start();
    ready(id);
    var entered = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    when(gateway.lookup(any())).thenReturn(order(id, "APPROVED", null));
    when(gateway.capture(any(), any()))
        .thenAnswer(
            c -> {
              entered.countDown();
              assertTrue(release.await(10, TimeUnit.SECONDS));
              return order(id, "COMPLETED", "COMPLETED");
            });
    action(at, "/paypal/" + id + "/approve");
    try (var pool = Executors.newSingleThreadExecutor()) {
      var work = pool.submit(() -> paypal.process(id));
      assertTrue(entered.await(10, TimeUnit.SECONDS));
      action(at, "/paypal/" + id + "/cancel");
      assertEquals(10001, state().path("bill").path("reservedBani").asLong());
      release.countDown();
      work.get(10, TimeUnit.SECONDS);
    } finally {
      release.countDown();
    }
    assertEquals(10001, paid());
  }

  @Test
  void retryWindowExpiryKeepsHoldAndRequiresReview() {
    UUID id = start();
    db.update(
        "UPDATE paypal_checkout SET create_started_at=now()-interval '6 hours' WHERE payment_id=?",
        id);
    paypal.process(id);
    assertEquals("REVIEW", phase(id));
    verifyNoInteractions(gateway);
    assertEquals(10001, state().path("bill").path("reservedBani").asLong());
  }

  @Test
  void pendingCaptureDoesNotSettleUntilLookupCompletes() {
    UUID id = start();
    ready(id);
    when(gateway.lookup(any()))
        .thenReturn(order(id, "APPROVED", null), order(id, "COMPLETED", "COMPLETED"));
    when(gateway.capture(any(), any())).thenReturn(order(id, "COMPLETED", "PENDING"));
    action(at, "/paypal/" + id + "/approve");
    paypal.process(id);
    assertEquals("PENDING_CAPTURE", phase(id));
    assertEquals(0, paid());
    due(id);
    paypal.process(id);
    assertEquals(10001, paid());
    verify(gateway, times(1)).capture(any(), any());
  }

  @Test
  void otherDinersAndSimulatorCannotChangePaypalAttempt() {
    UUID id = start();
    fails(403, bt, "/sessions/" + sid + "/paypal/" + id + "/approve", rev());
    fails(403, bt, "/sessions/" + sid + "/paypal/" + id + "/cancel", rev());
    assertEquals(
        403, send(bt, "GET", "/api/sessions/" + sid + "/paypal/" + id, null, null).status());
    fails(
        400,
        staff,
        "/sessions/" + sid + "/payments/" + id + "/confirm",
        rev("receivedBani", 10100, "reference", "fake", "collected", true));
    fails(
        400,
        at,
        "/sessions/" + sid + "/payments/" + id + "/test-result",
        rev("kind", "PAYMENT", "outcome", "SUCCEEDED", "deliver", true));
    assertEquals(0, paid());
  }

  @Test
  void anotherAttemptCannotReserveSamePortions() {
    start();
    fails(400, at, "/sessions/" + sid + "/paypal", rev("tipMinor", 0));
    assertEquals(
        1,
        db.number("SELECT count(*) FROM payment_attempt WHERE session_id=?", UUID.fromString(sid)));
  }

  @Test
  void approvedOrderRecoversWithoutBrowserReturning() {
    UUID id = start();
    ready(id);
    when(gateway.lookup(any())).thenReturn(order(id, "APPROVED", null));
    paypal.process(id);
    assertEquals("CAPTURE", phase(id));
    when(gateway.capture(any(), any())).thenReturn(order(id, "COMPLETED", "COMPLETED"));
    due(id);
    paypal.process(id);
    assertEquals(10001, paid());
  }

  @Test
  void expiredCaptureWindowUsesOnlyReadsAndCanResolveLateCompletion() {
    UUID id = start();
    ready(id);
    action(at, "/paypal/" + id + "/approve");
    db.update(
        "UPDATE paypal_checkout SET capture_started_at=now()-interval '6 hours' WHERE payment_id=?",
        id);
    paypal.process(id);
    assertEquals("REVIEW", phase(id));
    when(gateway.lookup(any()))
        .thenReturn(order(id, "APPROVED", null), order(id, "COMPLETED", "COMPLETED"));
    due(id);
    paypal.process(id);
    assertEquals("REVIEW", phase(id));
    assertEquals(0, paid());
    due(id);
    paypal.process(id);
    assertEquals(10001, paid());
    verify(gateway, never()).capture(any(), any());
  }

  @Test
  void concurrentStartsReserveOnlyOnce() throws Exception {
    item();
    var body = rev("tipMinor", 0);
    String path = "/api/sessions/" + sid + "/paypal";
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first = pool.submit(() -> send(at, "POST", path, body, UUID.randomUUID().toString()));
      var second = pool.submit(() -> send(at, "POST", path, body, UUID.randomUUID().toString()));
      var statuses = List.of(first.get().status(), second.get().status());
      assertEquals(1, statuses.stream().filter(s -> s == 200).count());
      assertTrue(statuses.contains(409));
    }
    assertEquals(10001, state().path("bill").path("reservedBani").asLong());
  }

  @Test
  void otherTableAndRestaurantCannotReadOrReplayAttempt() {
    UUID id = start();
    String originalSid = sid, originalToken = at;
    fixture(); // A second table belongs to a newly created, separate EUR restaurant.
    assertEquals(
        403,
        send(at, "GET", "/api/sessions/" + originalSid + "/paypal/" + id, null, null).status());
    fails(403, at, "/sessions/" + originalSid + "/paypal/" + id + "/approve", map("revision", 0));
    assertEquals(
        403,
        send(originalToken, "GET", "/api/sessions/" + sid + "/paypal/" + id, null, null).status());
  }
}

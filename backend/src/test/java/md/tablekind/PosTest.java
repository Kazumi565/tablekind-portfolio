package md.tablekind;

import static md.tablekind.pos.PosConnector.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import java.util.concurrent.*;
import md.tablekind.auth.Actor;
import md.tablekind.common.*;
import md.tablekind.pos.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

class PosTest extends WorkflowSupport {
  @Autowired PosWorker worker;
  @Autowired PosDelivery delivery;
  @Autowired PosSnapshots snapshots;
  @Autowired PosService pos;
  @Autowired MockPosConnector connector;
  @Autowired PosCatalog catalog;

  UUID rid() {
    return UUID.fromString(rid);
  }

  UUID sid() {
    return UUID.fromString(sid);
  }

  String prefix() {
    return "/restaurants/" + rid + "/pos";
  }

  JsonNode pos(String path, Object body) {
    return post(staff, prefix() + path, body);
  }

  JsonNode dashboard() {
    return ok(staff, "GET", "/api" + prefix(), null);
  }

  void mode(String m) {
    pos("/mock/mode", map("mode", m));
  }

  void connect() {
    action(staff, "/close");
    pos("/connect-test", Map.of());
    reopen();
  }

  void reopen() {
    var o = post(staff, "/restaurants/" + rid + "/tables/" + tid + "/sessions", Map.of());
    sid = o.path("sessionId").asText();
    join = o.path("joinToken").asText();
    var ga = post(null, "/join", map("token", join, "nickname", "Mihai"));
    a = ga.path("actorId").asText();
    at = ga.path("accessToken").asText();
    var gb = post(null, "/join", map("token", join, "nickname", "Diego"));
    b = gb.path("actorId").asText();
    bt = gb.path("accessToken").asText();
  }

  void drain() {
    worker.drain(rid(), 100);
  }

  long messages() {
    return db.number("SELECT count(*) FROM pos_outbox WHERE restaurant_id=?", rid());
  }

  long tickets() {
    return db.number("SELECT count(*) FROM mock_pos_kitchen_ticket WHERE restaurant_id=?", rid());
  }

  void due() {
    db.update(
        "UPDATE pos_outbox SET available_at=now()-interval '1 second' WHERE restaurant_id=? AND"
            + " status='RETRY'",
        rid());
  }

  JsonNode reconcile() {
    return pos("/sessions/" + sid + "/reconcile", Map.of());
  }

  Actor actor() {
    return new Actor(
        UUID.fromString(
            post(
                    null,
                    "/auth/login",
                    map("email", "manager@tablekind.test", "password", "Local-Review-2026!"))
                .path("actorId")
                .asText()),
        "STAFF",
        0);
  }

  String payment(String method, long amount, long tip) {
    return action(
            at,
            "/payments",
            "target",
            "SELF",
            "guestIds",
            List.of(),
            "amountBani",
            amount,
            "method",
            method,
            "tipBani",
            tip)
        .path("id")
        .asText();
  }

  @Test
  void connectionRequiresClosedTablesAndIsIdempotent() {
    fails(409, staff, prefix() + "/connect-test", Map.of());
    action(staff, "/close");
    String key = UUID.randomUUID().toString();
    var first = send(staff, "POST", "/api" + prefix() + "/connect-test", Map.of(), key);
    var second = send(staff, "POST", "/api" + prefix() + "/connect-test", Map.of(), key);
    assertEquals(200, first.status());
    assertEquals(first.body(), second.body());
    assertEquals(
        1, db.number("SELECT count(*) FROM mock_pos_account WHERE restaurant_id=?", rid()));
    assertEquals(0, messages());
    reopen();
    assertEquals(1, messages()); // Guest joins are not POS commands.
  }

  @Test
  void unconfiguredRestaurantsContinueWithoutOutbox() {
    item();
    assertEquals(0, messages());
    assertTrue(dashboard().path("connection").isNull());
  }

  @Test
  void acceptedOrderCreatesOneKitchenTicketAndExactBill() {
    connect();
    item();
    drain();
    assertEquals(1, tickets());
    var remote = connector.readBill(rid(), sid());
    assertEquals(10001, remote.bill().totalBani());
    assertEquals(1, remote.bill().lines().size());
    assertEquals("MATCH", reconcile().path("status").asText());
    drain();
    assertEquals(1, tickets());
  }

  @Test
  void lostReplyRetriesSameIdentityWithoutDuplicateKitchenOrPayment() {
    connect();
    drain();
    item();
    mode("LOSE_REPLY");
    drain();
    assertEquals(1, tickets());
    var retry = db.one("SELECT * FROM pos_outbox WHERE restaurant_id=? AND status='RETRY'", rid());
    assertEquals(1, Db.amount(retry, "attempts"));
    assertEquals(0, worker.drain(rid(), 100)); // Backoff, not a busy loop.
    assertEquals("PENDING", reconcile().path("status").asText());
    due();
    drain();
    assertEquals(2, db.number("SELECT attempts FROM pos_outbox WHERE id=?", Db.id(retry, "id")));
    assertEquals(1, tickets());
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void offlineQueueSurvivesAndReplaysInOrder() {
    connect();
    mode("OFFLINE");
    String id = item();
    action(staff, "/orders/" + id + "/status", "status", "CANCELLED", "reason", "Unavailable");
    drain();
    assertEquals(0, tickets());
    assertEquals(
        1,
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE restaurant_id=? AND status='RETRY'", rid()));
    assertTrue(messages() > 1);
    mode("ONLINE");
    due();
    drain();
    var remote = connector.readBill(rid(), sid());
    assertEquals(0, remote.bill().totalBani());
    assertEquals("CANCELLED", remote.bill().lines().getFirst().status());
    assertEquals(1, tickets());
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void permanentRejectionBlocksOnlyItsTableAndExplicitRetryRecovers() {
    connect();
    drain();
    String item = item();
    mode("REJECT");
    drain();
    var failed =
        db.one("SELECT * FROM pos_outbox WHERE restaurant_id=? AND status='FAILED'", rid());
    action(staff, "/orders/" + item + "/status", "status", "PREPARING", "reason", "");
    mode("ONLINE");
    drain();
    assertEquals(0, tickets());
    pos("/messages/" + failed.get("id") + "/retry", Map.of());
    drain();
    assertEquals(1, tickets());
    assertEquals("MATCH", reconcile().path("status").asText());
    assertEquals(2, db.number("SELECT attempts FROM pos_outbox WHERE id=?", Db.id(failed, "id")));
  }

  @Test
  void pauseQueuesNewWorkAndResumePreservesIt() {
    connect();
    pos("/pause", map("paused", true));
    item();
    drain();
    assertEquals(0, tickets());
    pos("/pause", map("paused", false));
    drain();
    assertEquals(1, tickets());
  }

  @Test
  void exhaustedAutomaticRetriesNeedManagerAction() {
    connect();
    mode("OFFLINE");
    for (int i = 0; i < 8; i++) {
      due();
      drain();
    }
    var row = db.one("SELECT * FROM pos_outbox WHERE restaurant_id=?", rid());
    assertEquals("FAILED", Db.text(row, "status"));
    assertEquals(8, Db.amount(row, "attempts"));
    mode("ONLINE");
    drain();
    assertEquals(0, db.number("SELECT count(*) FROM mock_pos_bill WHERE restaurant_id=?", rid()));
    pos("/messages/" + row.get("id") + "/retry", Map.of());
    drain();
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void crashAfterRemoteCommitRecoversByExpiredLeaseAndFencesOldWorker() {
    connect();
    drain();
    item();
    var original = delivery.claim(rid());
    assertNotNull(original);
    var receipt = connector.apply(original.command());
    assertEquals(1, tickets());
    db.update(
        "UPDATE pos_outbox SET lease_until=now()-interval '1 second' WHERE id=?",
        original.command().id());
    var replacement = delivery.claim(rid());
    assertNotNull(replacement);
    delivery.acknowledge(original, receipt);
    assertEquals(
        "IN_FLIGHT",
        Db.text(
            db.one("SELECT status FROM pos_outbox WHERE id=?", original.command().id()), "status"));
    delivery.acknowledge(replacement, connector.apply(replacement.command()));
    assertEquals(1, tickets());
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void mismatchedAcknowledgmentCannotMarkDelivered() {
    connect();
    var lease = delivery.claim(rid());
    var c = lease.command();
    assertThrows(
        Failure.class,
        () ->
            delivery.acknowledge(
                lease,
                new Receipt(
                    c.id(),
                    UUID.randomUUID(),
                    c.sessionId(),
                    c.revision(),
                    c.fingerprint(),
                    "wrong")));
    assertEquals(
        0, db.number("SELECT delivered_revision FROM pos_session WHERE session_id=?", sid()));
  }

  @Test
  void rollbackDoesNotLeakOutboxWork() {
    connect();
    long before = messages();
    new TransactionTemplate(tx)
        .execute(
            status -> {
              db.one("SELECT id FROM table_session WHERE id=? FOR UPDATE", sid());
              db.update(
                  "UPDATE table_session SET status='CLOSED',revision=revision+1 WHERE id=?", sid());
              snapshots.capture(rid(), sid());
              status.setRollbackOnly();
              return null;
            });
    assertEquals(before, messages());
    assertEquals("OPEN", state().path("session").path("status").asText());
  }

  @Test
  void immutablePayloadAndIdempotencyConflictAreRejected() {
    connect();
    var lease = delivery.claim(rid());
    connector.apply(lease.command());
    assertThrows(
        RuntimeException.class,
        () ->
            db.update(
                "UPDATE pos_outbox SET fingerprint='changed' WHERE id=?", lease.command().id()));
    var c = lease.command();
    assertThrows(
        Failure.class,
        () ->
            connector.apply(
                new Command(
                    c.id(), c.restaurantId(), c.sessionId(), c.revision(), "changed", c.bill())));
  }

  @Test
  void mixedPaymentsRefundAndClosedSessionStayReconciled() {
    connect();
    String id = item();
    String cash = payment("CASH", 4000, 500);
    action(
        staff,
        "/payments/" + cash + "/confirm",
        "receivedBani",
        5000,
        "reference",
        "",
        "collected",
        true);
    String card = payment("CARD", 6001, 200);
    action(
        staff,
        "/payments/" + card + "/test-result",
        "kind",
        "PAYMENT",
        "outcome",
        "SUCCEEDED",
        "deliver",
        true);
    for (String status : List.of("PREPARING", "READY", "SERVED"))
      action(staff, "/orders/" + id + "/status", "status", status, "reason", "");
    action(staff, "/close");
    String refund =
        action(
                staff,
                "/payments/" + cash + "/refunds",
                "amountBani",
                1000,
                "tipBani",
                100,
                "mode",
                "REDUCE_BILL",
                "reason",
                "Refund")
            .path("id")
            .asText();
    action(staff, "/refunds/" + refund + "/confirm", "reference", "", "returned", true);
    drain();
    var remote = connector.readBill(rid(), sid()).bill();
    assertEquals(9001, remote.totalBani());
    assertEquals(9001, remote.paidBani());
    assertEquals(600, remote.tipBani());
    assertEquals(2, remote.payments().size());
    assertEquals(1, remote.refunds().size());
    assertEquals("CLOSED", remote.status());
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void mismatchIsReportedWithoutRewritingMoney() {
    connect();
    item();
    drain();
    pos("/mock/sessions/" + sid, map("itemId", null, "status", "PREPARING", "offsetBani", 1));
    var report = reconcile();
    assertEquals("MISMATCH", report.path("status").asText());
    assertEquals(10001, report.path("localTotalBani").asLong());
    assertEquals(10002, report.path("posTotalBani").asLong());
    assertEquals(10001, state().path("bill").path("totalBani").asLong());
    pos("/mock/sessions/" + sid, map("itemId", null, "status", "PREPARING", "offsetBani", 0));
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void catalogSyncChangesPriceAndAvailabilityWithoutRepricingAcceptedItems() {
    connect();
    item();
    long originalVersion =
        db.number("SELECT version FROM product WHERE id=?", UUID.fromString(pid));
    assertEquals(0, pos("/catalog/import", Map.of()).path("changed").asInt());
    pos("/mock/products/" + pid, map("priceBani", 12500, "available", false));
    assertEquals(1, pos("/catalog/import", Map.of()).path("changed").asInt());
    var product = db.one("SELECT * FROM product WHERE id=?", UUID.fromString(pid));
    assertEquals(12500, Db.amount(product, "price_bani"));
    assertFalse(Db.bool(product, "available"));
    assertEquals(originalVersion + 1, Db.amount(product, "version"));
    assertEquals(10001, state().path("bill").path("totalBani").asLong());
    assertEquals(0, pos("/catalog/import", Map.of()).path("changed").asInt());
    assertEquals(
        409,
        send(
                staff,
                "PUT",
                "/api/restaurants/" + rid + "/products/" + pid + "/availability",
                map("available", true),
                UUID.randomUUID().toString())
            .status());
  }

  @Test
  void malformedCatalogRollsBackAndNewProductsImportWithStableMappings() {
    connect();
    Catalog old = connector.readCatalog(rid());
    var p = old.products().getFirst();
    var newProduct =
        new Product(
            "new-product",
            p.categoryRef(),
            p.categoryNames(),
            Map.of("en", "Soup"),
            Map.of(),
            List.of(),
            List.of(),
            5000,
            true,
            List.of());
    var source = new Catalog(old.revision() + 1, List.of(p, newProduct));
    new TransactionTemplate(tx).execute(s -> catalog.apply(rid(), source));
    assertEquals(2, db.number("SELECT count(*) FROM product WHERE restaurant_id=?", rid()));
    assertThrows(
        Problem.class,
        () ->
            new TransactionTemplate(tx)
                .execute(
                    s -> catalog.apply(rid(), new Catalog(source.revision() + 1, List.of(p, p)))));
    assertEquals(
        source.revision(),
        db.number("SELECT catalog_revision FROM pos_connection WHERE restaurant_id=?", rid()));
    var removed = new Catalog(source.revision() + 1, List.of(p));
    new TransactionTemplate(tx).execute(s -> catalog.apply(rid(), removed));
    assertEquals(
        0,
        db.number(
            "SELECT count(*) FROM product WHERE restaurant_id=? AND available AND"
                + " names->>'en'='Soup'",
            rid()));
    new TransactionTemplate(tx)
        .execute(
            s -> catalog.apply(rid(), new Catalog(removed.revision() + 1, List.of(p, newProduct))));
    assertEquals(
        2, db.number("SELECT count(*) FROM product WHERE restaurant_id=? AND available", rid()));
  }

  @Test
  void kitchenStatusesOnlyMoveForwardAndNeverChangeMoney() {
    connect();
    String id = item();
    drain();
    pos("/mock/sessions/" + sid, map("itemId", id, "status", "READY", "offsetBani", 0));
    assertEquals(1, pos("/sessions/" + sid + "/kitchen/import", Map.of()).path("changed").asInt());
    pos("/mock/sessions/" + sid, map("itemId", id, "status", "PREPARING", "offsetBani", 0));
    assertEquals(0, pos("/sessions/" + sid + "/kitchen/import", Map.of()).path("changed").asInt());
    assertEquals("READY", state().path("items").get(0).path("status").asText());
    assertEquals(10001, state().path("bill").path("totalBani").asLong());
  }

  @Test
  void guestCannotReadOrControlPosAndCrossRestaurantLookupFails() {
    connect();
    drain();
    assertEquals(403, send(at, "GET", "/api" + prefix(), null, null).status());
    fails(403, at, prefix() + "/pause", map("paused", true));
    String other = post(staff, "/restaurants", map("name", "Other restaurant")).path("id").asText();
    pos("/pause", map("paused", true));
    fails(
        404,
        staff,
        "/restaurants/"
            + other
            + "/pos/messages/"
            + dashboard().path("outbox").get(0).path("id").asText()
            + "/retry",
        Map.of());
    assertThrows(
        Problem.class,
        () ->
            pos.reconcile(
                actor(),
                rid(),
                sid(),
                new RemoteBill(
                    UUID.randomUUID(),
                    sid(),
                    1,
                    "bad",
                    connector.readBill(rid(), sid()).bill(),
                    Map.of())));
  }

  @Test
  void demotedManagerCannotReplayAnAuthorizedCommand() {
    connect();
    String email = "pos-" + UUID.randomUUID() + "@tablekind.local";
    String id =
        post(
                staff,
                "/restaurants/" + rid + "/staff",
                map(
                    "email",
                    email,
                    "displayName",
                    "Manager",
                    "password",
                    "Local-Staff-2026!",
                    "role",
                    "MANAGER"))
            .path("id")
            .asText();
    String token =
        post(null, "/auth/login", map("email", email, "password", "Local-Staff-2026!"))
            .path("accessToken")
            .asText();
    String key = UUID.randomUUID().toString();
    var body = map("paused", true);
    assertEquals(200, send(token, "POST", "/api" + prefix() + "/pause", body, key).status());
    db.update(
        "UPDATE membership SET role='WAITER' WHERE restaurant_id=? AND staff_id=?",
        rid(),
        UUID.fromString(id));
    assertEquals(403, send(token, "POST", "/api" + prefix() + "/pause", body, key).status());
    assertEquals(403, send(token, "GET", "/api" + prefix(), null, null).status());
  }

  @Test
  void concurrentWorkersClaimOnlyOneHeadPerTable() throws Exception {
    Assumptions.assumeFalse(SUPPLEMENTARY, "Requires native PostgreSQL concurrent connections");
    connect();
    item();
    try (var pool = Executors.newFixedThreadPool(2)) {
      var gate = new CountDownLatch(1);
      Callable<PosDelivery.Lease> task =
          () -> {
            gate.await();
            return delivery.claim(rid());
          };
      var one = pool.submit(task);
      var two = pool.submit(task);
      gate.countDown();
      var first = one.get();
      var second = two.get();
      assertTrue((first == null) != (second == null));
    }
  }

  @Test
  void importReplayDoesNotNeedThePosOnlineAfterSuccess() {
    connect();
    String key = UUID.randomUUID().toString();
    var first = send(staff, "POST", "/api" + prefix() + "/catalog/import", Map.of(), key);
    assertEquals(200, first.status());
    mode("OFFLINE");
    var repeated = send(staff, "POST", "/api" + prefix() + "/catalog/import", Map.of(), key);
    assertEquals(200, repeated.status());
    assertEquals(first.body(), repeated.body());
  }

  @Test
  void oneBlockedTableDoesNotStopAnother() {
    connect();
    drain();
    item();
    mode("REJECT");
    drain();
    String second =
        post(
                staff,
                "/restaurants/" + rid + "/branches/" + bid + "/tables",
                map("label", "T2", "pilotEnabled", true, "maxGuests", 20))
            .path("id")
            .asText();
    String other =
        post(staff, "/restaurants/" + rid + "/tables/" + second + "/sessions", Map.of())
            .path("sessionId")
            .asText();
    mode("ONLINE");
    drain();
    assertEquals(
        1,
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE restaurant_id=? AND status='FAILED'", rid()));
    assertEquals(
        1,
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE session_id=? AND status='DELIVERED'",
            UUID.fromString(other)));
  }

  @Test
  void changedCatalogPreservesOptionMappingsAndHistoricalOrderSnapshot() {
    String path = "/api/restaurants/" + rid + "/products/" + pid + "/modifiers";
    ok(
        staff,
        "PUT",
        path,
        map(
            "groups",
            List.of(
                map(
                    "names",
                    map("en", "Extras"),
                    "minSelect",
                    0,
                    "maxSelect",
                    1,
                    "options",
                    List.of(
                        map("names", map("en", "Cheese"), "priceBani", 100, "available", true))))));
    connect();
    String option =
        state()
            .path("menu")
            .path("products")
            .get(0)
            .path("modifierGroups")
            .get(0)
            .path("options")
            .get(0)
            .path("id")
            .asText();
    String item =
        action(
                at,
                "/orders",
                "productId",
                pid,
                "productVersion",
                2,
                "quantity",
                1,
                "optionIds",
                List.of(option),
                "note",
                "")
            .path("id")
            .asText();
    action(staff, "/orders/" + item + "/status", "status", "ACCEPTED", "reason", "");
    pos("/mock/products/" + pid, map("priceBani", 14000, "available", true));
    pos("/catalog/import", Map.of());
    String after =
        state()
            .path("menu")
            .path("products")
            .get(0)
            .path("modifierGroups")
            .get(0)
            .path("options")
            .get(0)
            .path("id")
            .asText();
    assertEquals(option, after);
    drain();
    var line = connector.readBill(rid(), sid()).bill().lines().getFirst();
    assertEquals(10101, line.totalBani());
    assertEquals(100, line.options().getFirst().priceBani());
    assertFalse(line.options().getFirst().externalId().startsWith("UNMAPPED:"));
    assertEquals("MATCH", reconcile().path("status").asText());
  }

  @Test
  void rejectedStaleAcceptanceDoesNotEnqueueOrCharge() {
    connect();
    String id =
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
                "")
            .path("id")
            .asText();
    long count = messages();
    pos("/mock/products/" + pid, map("priceBani", 20000, "available", true));
    pos("/catalog/import", Map.of());
    fails(
        409,
        staff,
        "/sessions/" + sid + "/orders/" + id + "/status",
        rev("status", "ACCEPTED", "reason", ""));
    assertEquals(count, messages());
    assertEquals(0, state().path("bill").path("totalBani").asLong());
  }

  @Test
  void expiredLastLeaseStopsWithVisibleFailure() {
    connect();
    var lease = delivery.claim(rid());
    db.update(
        "UPDATE pos_outbox SET cycle_attempts=8,lease_until=now()-interval '1 second' WHERE id=?",
        lease.command().id());
    assertNull(delivery.claim(rid()));
    assertEquals(
        "FAILED",
        Db.text(
            db.one("SELECT status FROM pos_outbox WHERE id=?", lease.command().id()), "status"));
    assertEquals(
        0, db.number("SELECT delivered_revision FROM pos_session WHERE session_id=?", sid()));
  }
}

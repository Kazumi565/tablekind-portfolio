package md.tablekind.paypal;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.Ledger;
import md.tablekind.common.*;
import md.tablekind.payments.Payments;
import md.tablekind.session.Sessions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Short transactions surround durable external operations. No browser assertion settles a bill. */
@Service
public class PayPalPayments {
  private final Db db;
  private final Access access;
  private final Sessions sessions;
  private final Ledger ledger;
  private final Payments payments;
  private final PayPalSettings settings;
  private final PayPalGateway gateway;
  private final TransactionTemplate tx;

  public PayPalPayments(
      Db db,
      Access access,
      Sessions sessions,
      Ledger ledger,
      Payments payments,
      PayPalSettings settings,
      PayPalGateway gateway,
      PlatformTransactionManager tm) {
    this.db = db;
    this.access = access;
    this.sessions = sessions;
    this.ledger = ledger;
    this.payments = payments;
    this.settings = settings;
    this.gateway = gateway;
    this.tx = new TransactionTemplate(tm);
  }

  public boolean available(UUID rid) {
    return settings.configured()
        && db.number(
                "SELECT count(*) FROM paypal_merchant m JOIN restaurant r ON r.id=m.restaurant_id"
                    + " WHERE r.id=? AND r.currency='EUR' AND m.merchant_id=?",
                rid,
                settings.merchantId())
            == 1;
  }

  public String clientId() {
    return settings.configured() ? settings.clientId() : "";
  }

  public void authorize(Actor a, UUID sid, UUID id) {
    access.guest(a, sid);
    if (id != null
        && db.number(
                "SELECT count(*) FROM payment_attempt WHERE id=? AND session_id=? AND payer_id=?"
                    + " AND provider='PAYPAL_SANDBOX'",
                id,
                sid,
                a.id())
            != 1) throw Problem.forbidden();
  }

  public Object start(Actor a, UUID sid, long revision, long tip) {
    authorize(a, sid, null);
    var s = sessions.lock(a, sid, revision);
    UUID rid = Db.id(s, "restaurant_id");
    if (!available(rid))
      throw new Problem(
          503, "PAYPAL_UNCONFIGURED", "PayPal sandbox is not configured for this EUR restaurant.");
    var parts = ledger.plan(sid, Set.of(a.id()), null);
    long amount = parts.stream().mapToLong(Ledger.Part::amountBani).sum();
    UUID id = UUID.randomUUID(), reservation = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " checkout_reservation(id,restaurant_id,session_id,payer_id,amount_bani,status,expires_at)"
            + " VALUES(?,?,?,?,?,'PROCESSING',now())",
        reservation,
        rid,
        sid,
        a.id(),
        amount);
    for (var p : parts)
      db.update(
          "INSERT INTO"
              + " reservation_part(restaurant_id,session_id,reservation_id,item_id,guest_id,amount_bani)"
              + " VALUES(?,?,?,?,?,?)",
          rid,
          sid,
          reservation,
          p.itemId(),
          p.guestId(),
          p.amountBani());
    db.update(
        "INSERT INTO"
            + " payment_attempt(id,restaurant_id,session_id,payer_id,reservation_id,method,provider,is_test,amount_bani,tip_bani,currency)"
            + " VALUES(?,?,?,?,?,'PAYPAL','PAYPAL_SANDBOX',true,?,?,'EUR')",
        id,
        rid,
        sid,
        a.id(),
        reservation,
        amount,
        tip);
    db.update(
        "INSERT INTO paypal_checkout(payment_id,merchant_id,create_request_id,capture_request_id)"
            + " VALUES(?,?,?,?)",
        id,
        settings.merchantId(),
        UUID.randomUUID(),
        UUID.randomUUID());
    sessions.event(
        a, s, "PAYPAL_REQUESTED", Map.of("paymentId", id, "amountMinor", amount, "tipMinor", tip));
    return Map.of("paymentId", id);
  }

  private Map<String, Object> row(UUID id) {
    return db.one(
        "SELECT"
            + " c.*,p.session_id,p.restaurant_id,p.payer_id,p.amount_bani,p.tip_bani,p.currency,p.status"
            + " FROM paypal_checkout c JOIN payment_attempt p ON p.id=c.payment_id WHERE"
            + " c.payment_id=?",
        id);
  }

  private Map<String, Object> lockSession(UUID id) {
    var p = row(id);
    return db.one("SELECT * FROM table_session WHERE id=? FOR UPDATE", Db.id(p, "session_id"));
  }

  public Object view(Actor a, UUID sid, UUID id) {
    authorize(a, sid, id);
    var p = row(id);
    return Map.of(
        "paymentId",
        id,
        "approvalUrl",
        Db.text(p, "approval_url"),
        "phase",
        p.get("phase"),
        "status",
        p.get("status"),
        "message",
        p.get("last_message"),
        "amountMinor",
        Db.amount(p, "amount_bani"),
        "tipMinor",
        Db.amount(p, "tip_bani"),
        "currency",
        p.get("currency"),
        "cancelRequested",
        p.get("cancel_requested"));
  }

  public Object capture(Actor a, UUID sid, UUID id) {
    authorize(a, sid, id);
    lockSession(id);
    var p = row(id);
    if ("APPROVAL".equals(p.get("phase")) && !Db.bool(p, "cancel_requested"))
      db.update(
          "UPDATE paypal_checkout SET phase='CAPTURE',next_attempt_at=now(),last_message='Verifying"
              + " PayPal approval' WHERE payment_id=?",
          id);
    else if (!Set.of("CAPTURE", "PENDING_CAPTURE", "RESOLVED").contains(Db.text(p, "phase")))
      throw Problem.conflict("This checkout cannot be captured. Check its current status.");
    return view(a, sid, id);
  }

  public Object cancel(Actor a, UUID sid, UUID id) {
    authorize(a, sid, id);
    var s = lockSession(id);
    var p = row(id);
    if (!"PENDING".equals(p.get("status"))) return view(a, sid, id);
    db.update("UPDATE paypal_checkout SET cancel_requested=true WHERE payment_id=?", id);
    if (p.get("capture_started_at") == null) {
      // This lock fences every capture dispatcher; no capture has ever been sent.
      db.update(
          "UPDATE paypal_checkout SET"
              + " phase='RESOLVED',lease_token=NULL,lease_until=NULL,last_message='Checkout"
              + " cancelled before capture' WHERE payment_id=?",
          id);
      payments.settlePayPal(s, id, "CANCELLED");
    } else
      db.update(
          "UPDATE paypal_checkout SET next_attempt_at=now(),last_message='Capture may have"
              + " completed. Checking before releasing your share.' WHERE payment_id=?",
          id);
    return view(a, sid, id);
  }

  public List<UUID> due() {
    return db
        .list(
            "SELECT payment_id FROM paypal_checkout WHERE (phase IN"
                + " ('CREATE','APPROVAL','CAPTURE','PENDING_CAPTURE') OR (phase='REVIEW' AND"
                + " order_id IS NOT NULL)) AND next_attempt_at<=now() AND (lease_until IS NULL OR"
                + " lease_until<now()) ORDER BY next_attempt_at LIMIT 10")
        .stream()
        .map(p -> Db.id(p, "payment_id"))
        .toList();
  }

  private Map<String, Object> claim(UUID id) {
    return tx.execute(
        t -> {
          lockSession(id);
          var p = row(id);
          if ((!Set.of("CREATE", "APPROVAL", "CAPTURE", "PENDING_CAPTURE", "REVIEW")
                      .contains(Db.text(p, "phase"))
                  || ("REVIEW".equals(p.get("phase")) && p.get("order_id") == null))
              || Db.time(p, "next_attempt_at").isAfter(Instant.now())
              || (p.get("lease_until") != null && Db.time(p, "lease_until").isAfter(Instant.now())))
            return null;
          String column =
              "CREATE".equals(p.get("phase")) ? "create_started_at" : "capture_started_at";
          // Default provider retention is six hours. Stop dispatch before that boundary.
          if (Set.of("CREATE", "CAPTURE").contains(Db.text(p, "phase"))
              && p.get(column) != null
              && Db.time(p, column).plus(Duration.ofHours(5)).isBefore(Instant.now())) {
            db.update(
                "UPDATE paypal_checkout SET"
                    + " phase='REVIEW',next_attempt_at=now(),last_message='Provider retry window"
                    + " exceeded. Checking known orders without sending another capture.' WHERE"
                    + " payment_id=?",
                id);
            return null;
          }
          UUID lease = UUID.randomUUID();
          String started =
              "APPROVAL".equals(p.get("phase"))
                  ? ""
                  : "," + column + "=coalesce(" + column + ",now())";
          db.update(
              "UPDATE paypal_checkout SET lease_token=?,lease_until=now()+interval '2"
                  + " minutes',attempts=attempts+1"
                  + started
                  + " WHERE payment_id=?",
              lease,
              id);
          return row(id);
        });
  }

  public void process(UUID id) {
    if (!settings.configured()) return;
    var p = claim(id);
    if (p == null) return;
    try {
      var expected =
          new PayPalGateway.Order(
              id,
              Db.text(p, "merchant_id"),
              Db.text(p, "currency"),
              Db.amount(p, "amount_bani") + Db.amount(p, "tip_bani"));
      if ("CREATE".equals(p.get("phase"))) {
        var order = gateway.create(expected, Db.id(p, "create_request_id"));
        verifyOrder(order, p, false);
        String approval = approvalUrl(order);
        acknowledge(
            p,
            () ->
                db.update(
                    "UPDATE paypal_checkout SET"
                        + " order_id=?,approval_url=?,phase='APPROVAL',lease_token=NULL,lease_until=NULL,last_message='Ready"
                        + " for PayPal approval' WHERE payment_id=?",
                    order.path("id").asText(),
                    approval,
                    id));
      } else {
        var order = gateway.lookup(Db.text(p, "order_id"));
        verifyOrder(order, p, true);
        if ("APPROVAL".equals(p.get("phase"))) {
          // Polling continues when the browser closes. A fresh claim fences cancellation
          // and persists capture_started_at before any capture can be dispatched.
          boolean approved = "APPROVED".equals(order.path("status").asText());
          acknowledge(
              p,
              () ->
                  db.update(
                      "UPDATE paypal_checkout SET"
                          + " phase=?,lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval"
                          + " '5 seconds',last_message=? WHERE payment_id=?",
                      approved ? "CAPTURE" : "APPROVAL",
                      approved
                          ? "PayPal approval verified; preparing capture"
                          : "Waiting for PayPal approval",
                      id));
          return;
        }
        if (order.path("purchase_units").get(0).path("payments").path("captures").isEmpty()
            && "APPROVED".equals(order.path("status").asText())
            && "CAPTURE".equals(p.get("phase"))
            && !Db.bool(p, "cancel_requested")) {
          order = gateway.capture(Db.text(p, "order_id"), Db.id(p, "capture_request_id"));
          verifyOrder(order, p, true);
        }
        applyOrder(p, order);
      }
    } catch (Mismatch e) {
      acknowledge(
          p,
          () ->
              db.update(
                  "UPDATE paypal_checkout SET"
                      + " phase='REVIEW',lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval"
                      + " '1 minute',last_message='PayPal details did not match. Share remains"
                      + " reserved for review.' WHERE payment_id=?",
                  id));
    } catch (Exception e) {
      // Do not persist provider payloads, authorization headers or exception messages.
      acknowledge(
          p,
          () ->
              db.update(
                  "UPDATE paypal_checkout SET"
                      + " lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '10"
                      + " seconds',last_message='PayPal outcome is not confirmed. Checking the"
                      + " original attempt.' WHERE payment_id=?",
                  id));
    }
  }

  private void acknowledge(Map<String, Object> claimed, Runnable action) {
    tx.executeWithoutResult(
        t -> {
          UUID id = Db.id(claimed, "payment_id");
          lockSession(id);
          var current = row(id);
          if (Objects.equals(current.get("lease_token"), claimed.get("lease_token"))) action.run();
        });
  }

  private static class Mismatch extends RuntimeException {}

  private static String approvalUrl(JsonNode order) {
    for (var link : order.path("links"))
      if (Set.of("approve", "payer-action").contains(link.path("rel").asText())) {
        try {
          var url = java.net.URI.create(link.path("href").asText());
          if ("https".equals(url.getScheme())
              && "www.sandbox.paypal.com".equals(url.getHost())
              && url.getUserInfo() == null
              && (url.getPort() == -1 || url.getPort() == 443)) return url.toString();
        } catch (IllegalArgumentException ignored) {
        }
      }
    throw new Mismatch();
  }

  private static long minor(JsonNode money) {
    try {
      return new BigDecimal(money.path("value").asText()).movePointRight(2).longValueExact();
    } catch (Exception e) {
      throw new Mismatch();
    }
  }

  public static void verifyOrder(JsonNode order, Map<String, Object> p, boolean existing) {
    var units = order.path("purchase_units");
    if (!order.path("id").asText().matches("[A-Za-z0-9]{5,64}")
        || units.size() != 1
        || (existing && !order.path("id").asText().equals(Db.text(p, "order_id"))))
      throw new Mismatch();
    var u = units.get(0);
    if (!"CAPTURE".equals(order.path("intent").asText())
        || !u.path("custom_id").asText().equals(Db.text(p, "payment_id"))
        || !u.path("payee").path("merchant_id").asText().equals(Db.text(p, "merchant_id"))
        || !u.path("amount").path("currency_code").asText().equals(Db.text(p, "currency"))
        || minor(u.path("amount")) != Db.amount(p, "amount_bani") + Db.amount(p, "tip_bani"))
      throw new Mismatch();
  }

  private void applyOrder(Map<String, Object> p, JsonNode order) {
    var captures = order.path("purchase_units").get(0).path("payments").path("captures");
    if (captures.size() > 1) throw new Mismatch();
    String outcome = "PENDING", captureId = "";
    if (captures.size() == 1) {
      var c = captures.get(0);
      captureId = c.path("id").asText();
      if (!captureId.matches("[A-Za-z0-9]{5,64}")
          || (p.get("capture_id") != null && !captureId.equals(Db.text(p, "capture_id")))
          || !c.path("amount").path("currency_code").asText().equals(p.get("currency"))
          || minor(c.path("amount")) != Db.amount(p, "amount_bani") + Db.amount(p, "tip_bani"))
        throw new Mismatch();
      outcome =
          switch (c.path("status").asText()) {
            case "COMPLETED" -> "SUCCEEDED";
            case "DECLINED", "FAILED" -> "FAILED";
            case "PENDING" -> "PENDING";
            default -> throw new Mismatch();
          };
    }
    final String result = outcome, external = captureId;
    acknowledge(
        p,
        () -> {
          UUID id = Db.id(p, "payment_id");
          if (!"PENDING".equals(result)) {
            var s = db.one("SELECT * FROM table_session WHERE id=?", Db.id(p, "session_id"));
            payments.settlePayPal(s, id, result);
            db.update(
                "UPDATE paypal_checkout SET"
                    + " capture_id=?,phase='RESOLVED',lease_token=NULL,lease_until=NULL,last_message=?"
                    + " WHERE payment_id=?",
                external,
                "SUCCEEDED".equals(result)
                    ? "PayPal payment verified"
                    : "PayPal declined the capture",
                id);
          } else {
            boolean captured = !external.isEmpty();
            db.update(
                "UPDATE paypal_checkout SET"
                    + " capture_id=?,phase=?,lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval"
                    + " '10 seconds',last_message='Waiting for a confirmed PayPal capture' WHERE"
                    + " payment_id=?",
                captured ? external : null,
                captured
                    ? "PENDING_CAPTURE"
                    : ("REVIEW".equals(p.get("phase")) ? "REVIEW" : "CAPTURE"),
                id);
          }
        });
  }
}

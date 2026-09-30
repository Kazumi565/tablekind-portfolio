package md.tablekind.payments;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.*;
import md.tablekind.common.*;
import md.tablekind.session.Sessions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Commands enter through Commands.run; the session row serializes every financial mutation. */
@Service
public class Payments {
  private final Db db;
  private final Access access;
  private final Sessions sessions;
  private final Ledger ledger;
  private final PaymentProvider provider;

  public Payments(
      Db db, Access access, Sessions sessions, Ledger ledger, PaymentProvider provider) {
    this.db = db;
    this.access = access;
    this.sessions = sessions;
    this.ledger = ledger;
    this.provider = provider;
  }

  public boolean testMode() {
    return provider.testMode();
  }

  public void requireTestPayments() {
    if (!provider.testMode())
      throw new Problem(
          503,
          "PAYMENTS_UNCONFIGURED",
          "Payments are unavailable in this profile. This release supports TEST payments only."
              + " Use the local or private demo installation with pretend money.");
  }

  public void requireManager(Actor a, UUID sid) {
    access.manager(a, Db.id(access.session(a, sid), "restaurant_id"));
  }

  private boolean online(Map<String, Object> p) {
    return Set.of("CARD", "MIA").contains(Db.text(p, "method"));
  }

  private boolean pending(Map<String, Object> p) {
    return "PENDING".equals(Db.text(p, "status"));
  }

  private long total(Map<String, Object> p) {
    return Db.amount(p, "amount_bani") + Db.amount(p, "tip_bani");
  }

  private Map<String, Object> payment(UUID sid, UUID id) {
    return db.one("SELECT * FROM payment_attempt WHERE session_id=? AND id=?", sid, id);
  }

  private Map<String, Object> refundRow(UUID sid, UUID id) {
    return db.one("SELECT * FROM payment_refund WHERE session_id=? AND id=?", sid, id);
  }

  private void owner(Actor a, Map<String, Object> p) {
    if (a.staff()) access.staff(a, Db.id(p, "restaurant_id"));
    else if (!a.id().equals(Db.id(p, "payer_id"))) throw Problem.forbidden();
  }

  private Map<String, Object> lock(Actor a, UUID sid, long revision, boolean allowClosed) {
    access.session(a, sid);
    var s = db.one("SELECT * FROM table_session WHERE id=? FOR UPDATE", sid);
    if (!allowClosed && !"OPEN".equals(Db.text(s, "status")))
      throw Problem.conflict("This table session is closed.");
    if (Db.amount(s, "revision") != revision)
      throw new Problem(
          409, "STALE_REVISION", "The table changed. Review the latest state and submit again.");
    return s;
  }

  private void activeGuest(UUID sid, UUID id) {
    if (id == null
        || db.number(
                "SELECT count(*) FROM guest WHERE id=? AND session_id=? AND active=true", id, sid)
            != 1) throw Problem.bad("Select an active guest at this table.");
  }

  public Object start(Actor a, UUID sid, PaymentController.Start r) {
    requireTestPayments();
    var s = lock(a, sid, r.revision(), false);
    UUID rid = Db.id(s, "restaurant_id"), payer = a.guest() ? a.id() : r.payerId();
    if (a.guest() && r.payerId() != null && !r.payerId().equals(a.id())) throw Problem.forbidden();
    activeGuest(sid, payer);
    boolean digital = Set.of("CARD", "MIA").contains(r.method());
    if (a.staff() && digital)
      throw Problem.bad("Online checkout must be started by the paying guest.");
    Set<UUID> targets =
        switch (r.target()) {
          case "SELF" -> Set.of(payer);
          case "REMAINDER" -> Set.of();
          case "GUESTS" -> {
            if (r.guestIds().isEmpty() || new HashSet<>(r.guestIds()).size() != r.guestIds().size())
              throw Problem.bad("Select different guests to cover.");
            r.guestIds().forEach(id -> activeGuest(sid, id));
            yield new HashSet<>(r.guestIds());
          }
          default -> throw Problem.bad("Unknown payment target.");
        };
    var parts = ledger.plan(sid, targets, r.amountBani());
    long amount = parts.stream().mapToLong(Ledger.Part::amountBani).sum();
    UUID id = UUID.randomUUID(), reservation = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " checkout_reservation(id,restaurant_id,session_id,payer_id,amount_bani,status,expires_at)"
            + " VALUES(?,?,?,?,?,'PROCESSING',now())",
        reservation,
        rid,
        sid,
        payer,
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
            + " payment_attempt(id,restaurant_id,session_id,payer_id,reservation_id,method,provider,is_test,amount_bani,tip_bani)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,
        rid,
        sid,
        payer,
        reservation,
        r.method(),
        digital ? provider.name() : "MANUAL",
        provider.testMode(),
        amount,
        r.tipBani());
    if (digital) provider.create(id, rid, "PAYMENT", amount + r.tipBani());
    sessions.event(
        a,
        s,
        "PAYMENT_REQUESTED",
        Map.of(
            "paymentId",
            id,
            "method",
            r.method(),
            "amountBani",
            amount,
            "tipBani",
            r.tipBani(),
            "test",
            provider.testMode()));
    return payment(sid, id);
  }

  public Object confirm(Actor a, UUID sid, UUID id, PaymentController.Confirm r) {
    requireTestPayments();
    var s = lock(a, sid, r.revision(), false);
    access.staff(a, Db.id(s, "restaurant_id"));
    var p = payment(sid, id);
    if (online(p))
      throw Problem.bad("Only a verified provider outcome can confirm online payment.");
    if (!pending(p)) throw Problem.conflict("This payment already has a final outcome.");
    if (!r.collected()) throw Problem.bad("Confirm that the money was actually collected.");
    long collected = total(p), change = 0;
    String reference = r.reference() == null ? "" : r.reference().trim();
    if ("CASH".equals(Db.text(p, "method"))) {
      if (r.receivedBani() == null || r.receivedBani() < collected)
        throw Problem.bad("Cash received must cover the bill amount and the agreed tip.");
      collected = r.receivedBani();
      change = collected - total(p);
    } else if (reference.isBlank())
      throw Problem.bad(
          "Enter the terminal transaction reference after the terminal confirms success.");
    db.update(
        "UPDATE payment_attempt SET received_bani=?,change_bani=?,manual_reference=?,confirmed_by=?"
            + " WHERE id=?",
        collected,
        change,
        reference,
        a.id(),
        id);
    settle(a, s, p, "SUCCEEDED");
    return payment(sid, id);
  }

  public Object cancel(Actor a, UUID sid, UUID id, long revision) {
    requireTestPayments();
    var s = lock(a, sid, revision, false);
    var p = payment(sid, id);
    owner(a, p);
    if (!pending(p)) throw Problem.conflict("This payment already has a final outcome.");
    // Once staff may have started collecting cash or using a terminal, only staff may cancel.
    if (!online(p)) {
      access.staff(a, Db.id(s, "restaurant_id"));
      settle(a, s, p, "CANCELLED");
    } else applyProvider(a, s, p, null, provider.cancel(id));
    return payment(sid, id);
  }

  public Object reconcile(Actor a, UUID sid, UUID id, long revision) {
    requireTestPayments();
    var s = lock(a, sid, revision, true);
    var p = payment(sid, id);
    owner(a, p);
    if (!online(p))
      throw Problem.bad(
          "Cash and terminal payments require staff confirmation, not provider lookup.");
    applyProvider(a, s, p, null, provider.lookup(id));
    if (a.staff())
      for (var r :
          db.list(
              "SELECT * FROM payment_refund WHERE payment_id=? AND status='PENDING' ORDER BY"
                  + " created_at,id",
              id)) applyProvider(a, s, p, r, provider.lookup(Db.id(r, "id")));
    return payment(sid, id);
  }

  private void settle(Actor a, Map<String, Object> s, Map<String, Object> p, String status) {
    if (!pending(p) || "PENDING".equals(status)) return;
    UUID id = Db.id(p, "id"),
        sid = Db.id(s, "id"),
        rid = Db.id(s, "restaurant_id"),
        reservation = Db.id(p, "reservation_id");
    if ("SUCCEEDED".equals(status)) {
      for (var part :
          db.list(
              "SELECT * FROM reservation_part WHERE reservation_id=? ORDER BY item_id,guest_id",
              reservation))
        settlement(
            rid,
            sid,
            Db.id(part, "item_id"),
            Db.id(part, "guest_id"),
            Db.amount(part, "amount_bani"),
            id,
            null);
    }
    db.update("UPDATE payment_attempt SET status=?,resolved_at=now() WHERE id=?", status, id);
    db.update(
        "UPDATE checkout_reservation SET status=? WHERE id=?",
        "SUCCEEDED".equals(status) ? "SETTLED" : "RELEASED",
        reservation);
    sessions.event(a, s, "PAYMENT_" + status, Map.of("paymentId", id));
  }

  private void settlement(
      UUID rid, UUID sid, UUID item, UUID guest, long amount, UUID payment, UUID refund) {
    db.update(
        "INSERT INTO"
            + " settlement_entry(id,restaurant_id,session_id,item_id,guest_id,amount_bani,external_reference,payment_id,refund_id)"
            + " VALUES(?,?,?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        rid,
        sid,
        item,
        guest,
        amount,
        (refund == null ? "payment:" : "refund:") + (refund == null ? payment : refund),
        payment,
        refund);
  }

  public Object refund(Actor a, UUID sid, UUID paymentId, PaymentController.Refund r) {
    requireTestPayments();
    var s = lock(a, sid, r.revision(), true);
    UUID rid = Db.id(s, "restaurant_id");
    access.manager(a, rid);
    var p = payment(sid, paymentId);
    if (!"SUCCEEDED".equals(Db.text(p, "status")))
      throw Problem.conflict("Only a confirmed payment can be refunded.");
    if (r.amountBani() + r.tipBani() < 1)
      throw Problem.bad("Enter a positive bill refund or tip refund.");
    if ("CLOSED".equals(Db.text(s, "status"))
        && "RETURN_PAYMENT".equals(r.mode())
        && r.amountBani() > 0)
      throw Problem.conflict("A closed session only permits charge-reducing or tip-only refunds.");
    long used =
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM payment_refund WHERE payment_id=? AND status"
                + " IN ('PENDING','SUCCEEDED')",
            paymentId);
    long usedTip =
        db.number(
            "SELECT coalesce(sum(tip_bani),0) FROM payment_refund WHERE payment_id=? AND status IN"
                + " ('PENDING','SUCCEEDED')",
            paymentId);
    if (r.amountBani() > Db.amount(p, "amount_bani") - used
        || r.tipBani() > Db.amount(p, "tip_bani") - usedTip)
      throw Problem.conflict(
          "The refund exceeds this payment's remaining refundable amount (including pending"
              + " refunds).");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " payment_refund(id,restaurant_id,session_id,payment_id,amount_bani,tip_bani,mode,reason,requested_by)"
            + " VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        rid,
        sid,
        paymentId,
        r.amountBani(),
        r.tipBani(),
        r.mode(),
        r.reason().trim(),
        a.id());
    long left = r.amountBani();
    for (var part :
        db.list(
            "SELECT p.item_id,p.guest_id,p.amount_bani-coalesce((SELECT sum(x.amount_bani) FROM"
                + " refund_part x JOIN payment_refund r ON r.id=x.refund_id WHERE r.payment_id=?"
                + " AND r.status IN ('PENDING','SUCCEEDED') AND x.item_id=p.item_id AND"
                + " x.guest_id=p.guest_id),0) AS available FROM reservation_part p WHERE"
                + " reservation_id=? ORDER BY p.item_id,p.guest_id",
            paymentId,
            Db.id(p, "reservation_id"))) {
      long take = Math.min(left, Db.amount(part, "available"));
      if (take > 0)
        db.update(
            "INSERT INTO"
                + " refund_part(restaurant_id,session_id,refund_id,item_id,guest_id,amount_bani)"
                + " VALUES(?,?,?,?,?,?)",
            rid,
            sid,
            id,
            Db.id(part, "item_id"),
            Db.id(part, "guest_id"),
            take);
      left -= take;
    }
    if (left != 0)
      throw Problem.conflict("The requested refund cannot be allocated to the original payment.");
    if (online(p)) provider.create(id, rid, "REFUND", r.amountBani() + r.tipBani());
    sessions.event(
        a,
        s,
        "REFUND_REQUESTED",
        Map.of(
            "refundId", id, "paymentId", paymentId, "reason", r.reason().trim(), "mode", r.mode()));
    return refundRow(sid, id);
  }

  public Object confirmRefund(Actor a, UUID sid, UUID id, PaymentController.RefundConfirm r) {
    requireTestPayments();
    var s = lock(a, sid, r.revision(), true);
    access.manager(a, Db.id(s, "restaurant_id"));
    var refund = refundRow(sid, id);
    var p = payment(sid, Db.id(refund, "payment_id"));
    if (online(p)) throw Problem.bad("Online refunds require a confirmed provider outcome.");
    if (!pending(refund)) throw Problem.conflict("This refund already has a final outcome.");
    if (!r.returned()) throw Problem.bad("Confirm that the money was actually returned.");
    String reference = r.reference() == null ? "" : r.reference().trim();
    if ("TERMINAL".equals(Db.text(p, "method")) && reference.isBlank())
      throw Problem.bad("Enter the terminal refund reference.");
    db.update(
        "UPDATE payment_refund SET confirmed_by=?,manual_reference=? WHERE id=?",
        a.id(),
        reference,
        id);
    settleRefund(a, s, p, refund, "SUCCEEDED");
    return refundRow(sid, id);
  }

  public Object cancelRefund(Actor a, UUID sid, UUID id, long revision) {
    requireTestPayments();
    var s = lock(a, sid, revision, true);
    access.manager(a, Db.id(s, "restaurant_id"));
    var r = refundRow(sid, id);
    var p = payment(sid, Db.id(r, "payment_id"));
    if (!pending(r)) throw Problem.conflict("This refund already has a final outcome.");
    if (online(p)) applyProvider(a, s, p, r, provider.cancel(id));
    else settleRefund(a, s, p, r, "CANCELLED");
    return refundRow(sid, id);
  }

  private void settleRefund(
      Actor a, Map<String, Object> s, Map<String, Object> p, Map<String, Object> r, String status) {
    if (!pending(r) || "PENDING".equals(status)) return;
    UUID rid = Db.id(s, "restaurant_id"), sid = Db.id(s, "id"), id = Db.id(r, "id");
    if ("SUCCEEDED".equals(status))
      for (var part :
          db.list("SELECT * FROM refund_part WHERE refund_id=? ORDER BY item_id,guest_id", id)) {
        UUID item = Db.id(part, "item_id"), guest = Db.id(part, "guest_id");
        long amount = Db.amount(part, "amount_bani");
        settlement(rid, sid, item, guest, -amount, Db.id(p, "id"), id);
        if ("REDUCE_BILL".equals(Db.text(r, "mode"))) {
          ledger.charge(rid, sid, item, -amount, "REFUND", Db.text(r, "reason"), id);
          ledger.allocate(rid, sid, item, guest, -amount, Db.text(r, "reason"), id);
        }
      }
    db.update("UPDATE payment_refund SET status=?,resolved_at=now() WHERE id=?", status, id);
    sessions.event(a, s, "REFUND_" + status, Map.of("refundId", id, "paymentId", Db.id(p, "id")));
  }

  private void applyProvider(
      Actor a,
      Map<String, Object> s,
      Map<String, Object> p,
      Map<String, Object> refund,
      PaymentProvider.Intent i) {
    var target = refund == null ? p : refund;
    if (!provider.name().equals(Db.text(p, "provider"))
        || !i.id().equals(Db.id(target, "id"))
        || !i.restaurantId().equals(Db.id(p, "restaurant_id"))
        || i.amountBani() != total(target)
        || !i.currency().equals(Db.text(p, "currency"))
        || !i.kind().equals(refund == null ? "PAYMENT" : "REFUND"))
      throw Problem.conflict(
          "Provider reference, merchant, currency or amount does not match. Do not collect again;"
              + " investigate.");
    if (!pending(target) && !i.status().equals(Db.text(target, "status")))
      throw Problem.conflict(
          "Provider outcome conflicts with the recorded outcome. Manual investigation is"
              + " required.");
    if (refund == null) settle(a, s, p, i.status());
    else settleRefund(a, s, p, refund, i.status());
  }

  /**
   * Invoked after signature verification. A verified event is a prompt to read authoritative state.
   */
  public Object event(PaymentProvider.Event e, String fingerprint) {
    requireTestPayments();
    db.number(
        "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtextextended(?,0))) x",
        provider.name() + ":" + e.eventId());
    var old =
        db.optional(
            "SELECT * FROM payment_webhook WHERE provider=? AND event_id=?",
            provider.name(),
            e.eventId());
    if (old.isPresent()) {
      if (!fingerprint.equals(Db.text(old.get(), "fingerprint")))
        throw Problem.conflict("An event ID was reused with a different payload.");
      return Map.of("accepted", true, "duplicate", true);
    }
    boolean isRefund = "REFUND".equals(e.kind());
    var target =
        db.one(
            "SELECT * FROM " + (isRefund ? "payment_refund" : "payment_attempt") + " WHERE id=?",
            e.intentId());
    UUID sid = Db.id(target, "session_id");
    var s = db.one("SELECT * FROM table_session WHERE id=? FOR UPDATE", sid);
    // Reload after taking the same lock as user commands.
    target = isRefund ? refundRow(sid, e.intentId()) : payment(sid, e.intentId());
    var p = isRefund ? payment(sid, Db.id(target, "payment_id")) : target;
    if (!e.restaurantId().equals(Db.id(p, "restaurant_id"))
        || e.amountBani() != total(target)
        || !e.currency().equals(Db.text(p, "currency")))
      throw Problem.conflict("Provider event does not match the merchant, currency or amount.");
    var i = provider.lookup(e.intentId());
    applyProvider(new Actor(e.intentId(), "PROVIDER", 0), s, p, isRefund ? target : null, i);
    db.update(
        "INSERT INTO payment_webhook(provider,event_id,fingerprint,intent_id,outcome)"
            + " VALUES(?,?,?,?,?)",
        provider.name(),
        e.eventId(),
        fingerprint,
        e.intentId(),
        i.status());
    return Map.of("accepted", true, "duplicate", false, "status", i.status());
  }

  public Object testResult(
      Actor a,
      UUID sid,
      UUID id,
      long revision,
      String kind,
      String outcome,
      boolean deliver,
      LocalTestProvider simulator,
      PaymentEvents events) {
    var s = lock(a, sid, revision, true);
    var r = "REFUND".equals(kind) ? refundRow(sid, id) : null;
    var p = payment(sid, r == null ? id : Db.id(r, "payment_id"));
    if (r != null) access.manager(a, Db.id(s, "restaurant_id"));
    else owner(a, p);
    if (!online(p) || !Db.bool(p, "is_test"))
      throw Problem.bad("Only local test online payments have simulated provider outcomes.");
    simulator.resolve(id, outcome);
    sessions.event(
        a,
        s,
        "TEST_PROVIDER_RESOLVED",
        Map.of("intentId", id, "kind", kind, "outcome", outcome, "notificationDelivered", deliver));
    if (deliver) {
      var e = simulator.notification(id);
      events.receive(e.body(), e.timestamp(), e.signature());
    }
    return r == null ? payment(sid, id) : refundRow(sid, id);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Object confirmation(Actor a, UUID sid, UUID id) {
    access.session(a, sid);
    var p = payment(sid, id);
    owner(a, p);
    if (!"SUCCEEDED".equals(Db.text(p, "status")))
      throw Problem.conflict("A payment confirmation is available only after success.");
    var result = new LinkedHashMap<String, Object>();
    result.put(
        "title", Db.bool(p, "is_test") ? "TEST payment confirmation" : "Payment confirmation");
    result.put(
        "notice",
        "Not a fiscal receipt. The restaurant's existing POS remains responsible for its fiscal"
            + " receipt.");
    result.put(
        "restaurant",
        db.one("SELECT name,currency FROM restaurant WHERE id=?", Db.id(p, "restaurant_id")));
    result.put("payment", p);
    result.put(
        "parts",
        db.list(
            "SELECT r.item_id,r.guest_id,g.nickname,r.amount_bani,o.snapshot FROM reservation_part"
                + " r JOIN guest g ON g.id=r.guest_id JOIN order_item o ON o.id=r.item_id WHERE"
                + " reservation_id=? ORDER BY r.item_id,r.guest_id",
            Db.id(p, "reservation_id")));
    result.put(
        "refunds",
        db.list("SELECT * FROM payment_refund WHERE payment_id=? ORDER BY created_at,id", id));
    return result;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Object report(Actor a, UUID sid) {
    var s = access.session(a, sid);
    access.manager(a, Db.id(s, "restaurant_id"));
    var rows =
        db.list(
            "SELECT p.*,coalesce((SELECT sum(amount_bani) FROM settlement_entry WHERE"
                + " payment_id=p.id),0) AS ledger_bani,coalesce((SELECT sum(amount_bani) FROM"
                + " payment_refund WHERE payment_id=p.id AND status='SUCCEEDED'),0) AS"
                + " refunded_bani,coalesce((SELECT sum(tip_bani) FROM payment_refund WHERE"
                + " payment_id=p.id AND status='SUCCEEDED'),0) AS refunded_tip_bani FROM"
                + " payment_attempt p WHERE session_id=? ORDER BY created_at,id",
            sid);
    long expected = 0, linked = 0, tip = 0;
    for (var p : rows) {
      long net =
          "SUCCEEDED".equals(Db.text(p, "status"))
              ? Db.amount(p, "amount_bani") - Db.amount(p, "refunded_bani")
              : 0;
      p.put("expected_net_bani", net);
      p.put("balanced", net == Db.amount(p, "ledger_bani"));
      expected += net;
      linked += Db.amount(p, "ledger_bani");
      if ("SUCCEEDED".equals(Db.text(p, "status")))
        tip += Db.amount(p, "tip_bani") - Db.amount(p, "refunded_tip_bani");
    }
    long unlinked =
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM settlement_entry WHERE session_id=? AND"
                + " payment_id IS NULL",
            sid);
    return Map.of(
        "payments",
        rows,
        "expectedNetBani",
        expected,
        "linkedLedgerBani",
        linked,
        "unlinkedLedgerBani",
        unlinked,
        "netTipsBani",
        tip,
        "balanced",
        expected == linked && unlinked == 0,
        "bill",
        ledger.bill(sid),
        "notice",
        "Internal ledger reconciliation only. No bank settlement or POS reconciliation is"
            + " configured.");
  }
}

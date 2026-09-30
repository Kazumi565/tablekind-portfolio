package md.tablekind.session;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.Ledger;
import md.tablekind.common.Db;
import md.tablekind.payments.Payments;
import md.tablekind.restaurant.CatalogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class SessionView {
  private final Db db;
  private final Access access;
  private final Ledger ledger;
  private final CatalogService catalog;
  private final Payments payments;

  public SessionView(
      Db db, Access access, Ledger ledger, CatalogService catalog, Payments payments) {
    this.db = db;
    this.access = access;
    this.ledger = ledger;
    this.catalog = catalog;
    this.payments = payments;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Map<String, Object> state(Actor a, UUID sid) {
    var session = access.session(a, sid);
    UUID rid = Db.id(session, "restaurant_id");
    session.remove("qr_hash");
    var items = db.list("SELECT * FROM order_item WHERE session_id=? ORDER BY created_at,id", sid);
    for (var item : items) {
      UUID id = Db.id(item, "id");
      item.put("total_bani", ledger.total(sid, id));
      item.put(
          "shares",
          ledger.shares(sid, id).entrySet().stream()
              .map(e -> Map.of("guestId", e.getKey(), "amountBani", e.getValue()))
              .toList());
      item.put(
          "adjustments",
          db.list(
              "SELECT amount_bani,kind,reason,batch_id,created_at FROM bill_entry WHERE item_id=?"
                  + " ORDER BY created_at,id",
              id));
    }
    var proposals =
        db.list("SELECT * FROM allocation_proposal WHERE session_id=? ORDER BY created_at,id", sid);
    for (var p : proposals) {
      p.put(
          "shares",
          db.list(
              "SELECT item_id,guest_id,amount_bani FROM proposed_share WHERE proposal_id=? ORDER BY"
                  + " item_id,guest_id",
              Db.id(p, "id")));
      p.put(
          "votes",
          db.list(
              "SELECT guest_id,accepted FROM proposal_vote WHERE proposal_id=? ORDER BY guest_id",
              Db.id(p, "id")));
    }
    var reservations =
        db.list(
            "SELECT *,CASE WHEN status='HELD' AND expires_at<=now() THEN 'EXPIRED' ELSE status END"
                + " AS effective_status FROM checkout_reservation WHERE session_id=? ORDER BY"
                + " created_at DESC",
            sid);
    var result = new LinkedHashMap<String, Object>();
    result.put("session", session);
    result.put(
        "pos",
        a.staff()
            ? db.optional(
                    "SELECT p.delivered_revision,c.paused,(SELECT count(*) FROM pos_outbox o WHERE"
                        + " o.session_id=p.session_id AND o.status<>'DELIVERED') AS pending,(SELECT"
                        + " count(*) FROM pos_outbox o WHERE o.session_id=p.session_id AND"
                        + " o.status='FAILED') AS failed FROM pos_session p JOIN pos_connection c"
                        + " ON c.restaurant_id=p.restaurant_id WHERE p.session_id=?",
                    sid)
                .orElse(null)
            : null);
    result.put(
        "table",
        db.one(
            "SELECT t.label,t.max_guests,b.name AS branch_name,r.name AS"
                + " restaurant_name,b.approval_required,b.operating_mode,b.languages,b.default_language"
                + " FROM dining_table t JOIN branch b ON b.id=t.branch_id JOIN restaurant r ON"
                + " r.id=t.restaurant_id WHERE t.id=?",
            Db.id(session, "table_id")));
    result.put(
        "guests",
        db.list(
            "SELECT id,nickname,active,joined_at FROM guest WHERE session_id=? ORDER BY"
                + " joined_at,id",
            sid));
    result.put("items", items);
    result.put("proposals", proposals);
    result.put("reservations", reservations);
    result.put("testPayments", payments.testMode());
    result.put("paymentsEnabled", payments.testMode());
    var paymentRows =
        db.list(
            "SELECT"
                + " id,payer_id,reservation_id,method,provider,is_test,amount_bani,tip_bani,currency,status,received_bani,change_bani,created_at,resolved_at"
                + " FROM payment_attempt WHERE session_id=? ORDER BY created_at DESC,id",
            sid);
    for (var p : paymentRows) {
      UUID id = Db.id(p, "id");
      p.put(
          "refunds",
          db.list(
              "SELECT id,amount_bani,tip_bani,mode,status,reason,created_at,resolved_at FROM"
                  + " payment_refund WHERE payment_id=? ORDER BY created_at,id",
              id));
      p.put(
          "parts",
          db.list(
              "SELECT item_id,guest_id,amount_bani FROM reservation_part WHERE reservation_id=?"
                  + " ORDER BY item_id,guest_id",
              Db.id(p, "reservation_id")));
    }
    result.put("payments", paymentRows);
    result.put("bill", ledger.bill(sid));
    result.put(
        "help",
        db.list("SELECT * FROM assistance_request WHERE session_id=? ORDER BY created_at,id", sid));
    result.put("menu", catalog.menu(rid));
    result.put(
        "actor",
        Map.of("id", a.id(), "kind", a.kind(), "role", a.staff() ? access.staff(a, rid) : "GUEST"));
    result.put(
        "audit",
        a.staff()
            ? db.list(
                "SELECT id,actor_id,action,detail,created_at FROM audit_event WHERE session_id=?"
                    + " ORDER BY id DESC LIMIT 100",
                sid)
            : List.of());
    return result;
  }
}

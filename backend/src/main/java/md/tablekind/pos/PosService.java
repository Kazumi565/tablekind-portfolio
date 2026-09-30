package md.tablekind.pos;

import static md.tablekind.pos.PosConnector.*;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.session.Sessions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PosService {
  private final Db db;
  private final Access access;
  private final PosCatalog catalog;
  private final PosSnapshots snapshots;
  private final Sessions sessions;
  private final PosWorker worker;

  public PosService(
      Db db,
      Access access,
      PosCatalog catalog,
      PosSnapshots snapshots,
      Sessions sessions,
      PosWorker worker) {
    this.db = db;
    this.access = access;
    this.catalog = catalog;
    this.snapshots = snapshots;
    this.sessions = sessions;
    this.worker = worker;
  }

  public void manager(Actor a, UUID rid) {
    access.manager(a, rid);
  }

  public void staff(Actor a, UUID rid) {
    access.staff(a, rid);
  }

  private void mock() {
    if (!worker.mockAvailable())
      throw new Problem(
          503,
          "POS_UNCONFIGURED",
          "No real POS is configured. The test simulator is only available in the local profile.");
  }

  private void audit(Actor a, UUID rid, UUID sid, String action, Object detail) {
    db.update(
        "INSERT INTO audit_event(restaurant_id,session_id,actor_id,action,detail)"
            + " VALUES(?,?,?,?,?::jsonb)",
        rid,
        sid,
        a.id(),
        action,
        db.json(detail));
  }

  public Object connect(Actor a, UUID rid) {
    manager(a, rid);
    mock();
    db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE", rid);
    if (db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) > 0)
      throw Problem.conflict("A connector already exists; pause or resume it instead.");
    if (db.number("SELECT count(*) FROM table_session WHERE restaurant_id=? AND status='OPEN'", rid)
        > 0)
      throw Problem.conflict(
          "Close existing table sessions before connecting. Only new sessions are sent to the"
              + " POS.");
    db.update("INSERT INTO pos_connection(restaurant_id,connector) VALUES(?,'MOCK')", rid);
    catalog.seed(rid);
    audit(a, rid, null, "POS_TEST_CONNECTED", Map.of());
    return Map.of("connector", "MOCK", "test", true);
  }

  public Object pause(Actor a, UUID rid, boolean paused) {
    manager(a, rid);
    if (db.update("UPDATE pos_connection SET paused=? WHERE restaurant_id=?", paused, rid) != 1)
      throw Problem.missing();
    audit(a, rid, null, paused ? "POS_PAUSED" : "POS_RESUMED", Map.of());
    return Map.of("paused", paused);
  }

  public Object retry(Actor a, UUID rid, UUID id) {
    manager(a, rid);
    var row = db.one("SELECT * FROM pos_outbox WHERE restaurant_id=? AND id=? FOR UPDATE", rid, id);
    if (!Set.of("RETRY", "FAILED").contains(Db.text(row, "status")))
      throw Problem.conflict(
          "Only failed or waiting-retry messages can be retried. In-flight work must resolve"
              + " first.");
    db.update(
        "UPDATE pos_outbox SET status='PENDING',cycle_attempts=0,available_at=now(),last_error=NULL"
            + " WHERE id=?",
        id);
    audit(a, rid, Db.id(row, "session_id"), "POS_RETRY_REQUESTED", Map.of("messageId", id));
    return Map.of("queued", true, "messageId", id);
  }

  @Transactional(readOnly = true)
  public Object dashboard(Actor a, UUID rid) {
    staff(a, rid);
    var result = new LinkedHashMap<String, Object>();
    result.put("mockAvailable", worker.mockAvailable());
    result.put(
        "connection",
        db.optional("SELECT * FROM pos_connection WHERE restaurant_id=?", rid).orElse(null));
    result.put(
        "counts",
        db.list(
            "SELECT status,count(*) AS count FROM pos_outbox WHERE restaurant_id=? GROUP BY status",
            rid));
    result.put(
        "outbox",
        db.list(
            "SELECT"
                + " o.id,o.sequence,o.session_id,o.revision,o.status,o.attempts,o.available_at,o.lease_until,o.last_error,o.created_at,o.delivered_at,t.label"
                + " FROM pos_outbox o JOIN table_session s ON s.id=o.session_id JOIN dining_table t"
                + " ON t.id=s.table_id WHERE o.restaurant_id=? ORDER BY o.sequence DESC LIMIT 100",
            rid));
    result.put(
        "sessions",
        db.list(
            "SELECT p.*,t.label,s.status AS session_status,coalesce((SELECT max(revision) FROM"
                + " pos_outbox WHERE session_id=p.session_id),0) AS queued_revision FROM"
                + " pos_session p JOIN table_session s ON s.id=p.session_id JOIN dining_table t ON"
                + " t.id=s.table_id WHERE p.restaurant_id=? ORDER BY s.opened_at DESC,p.session_id"
                + " LIMIT 50",
            rid));
    result.put(
        "simulation",
        worker.mockAvailable()
            ? db.optional(
                    "SELECT failure_mode,catalog_revision FROM mock_pos_account WHERE"
                        + " restaurant_id=?",
                    rid)
                .orElse(null)
            : null);
    result.put(
        "notice",
        "TEST POS only. Delivery acknowledges a simulator, not a real kitchen or fiscal receipt."
            + " Use the restaurant's usual POS during an outage; do not manually re-enter an"
            + " uncertain order without checking it first.");
    return result;
  }

  public Object importCatalog(Actor a, UUID rid, Catalog source) {
    manager(a, rid);
    var result = catalog.apply(rid, source);
    audit(a, rid, null, "POS_CATALOG_IMPORTED", result);
    return result;
  }

  @Transactional
  public Object reconcile(Actor a, UUID rid, UUID sid, RemoteBill remote) {
    staff(a, rid);
    validateRemote(rid, sid, remote);
    db.one("SELECT id FROM table_session WHERE restaurant_id=? AND id=? FOR UPDATE", rid, sid);
    var tracked =
        db.one("SELECT * FROM pos_session WHERE restaurant_id=? AND session_id=?", rid, sid);
    Bill local = snapshots.bill(rid, sid), other = remote.bill();
    List<String> differences = new ArrayList<>();
    if (!local.currency().equals(other.currency())) differences.add("Currency differs");
    if (!local.tableRef().equals(other.tableRef())) differences.add("Table mapping differs");
    if (!local.status().equals(other.status())) differences.add("Session status differs");
    if (local.totalBani() != other.totalBani()) differences.add("Bill total differs");
    if (local.paidBani() != other.paidBani()) differences.add("Confirmed payments differ");
    if (local.tipBani() != other.tipBani()) differences.add("Net tips differ");
    if (!local.lines().equals(other.lines())) differences.add("Item/charge details differ");
    if (!local.payments().equals(other.payments()))
      differences.add("Payment references/details differ");
    if (!local.refunds().equals(other.refunds())) differences.add("Refund details differ");
    if (remote.revision() != Db.amount(tracked, "delivered_revision"))
      differences.add("POS acknowledgment revision differs");
    if (!remote.externalBillId().equals(Db.text(tracked, "external_bill_id")))
      differences.add("POS bill reference differs");
    long pending =
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE session_id=? AND status<>'DELIVERED'", sid);
    long latest =
        db.number("SELECT coalesce(max(revision),0) FROM pos_outbox WHERE session_id=?", sid);
    var report = new LinkedHashMap<String, Object>();
    report.put("status", pending > 0 ? "PENDING" : differences.isEmpty() ? "MATCH" : "MISMATCH");
    report.put("checkedRevision", latest);
    report.put("posRevision", remote.revision());
    report.put("differences", differences);
    report.put("pendingMessages", pending);
    report.put("localTotalBani", local.totalBani());
    report.put("posTotalBani", other.totalBani());
    report.put("localPaidBani", local.paidBani());
    report.put("posPaidBani", other.paidBani());
    report.put("localTipBani", local.tipBani());
    report.put("posTipBani", other.tipBani());
    report.put("test", true);
    report.put(
        "note", "Read-only comparison. No charges, payments or fiscal receipts were changed.");
    db.update(
        "UPDATE pos_session SET reconciliation=?::jsonb,reconciled_at=now() WHERE session_id=?",
        db.json(report),
        sid);
    audit(a, rid, sid, "POS_RECONCILED", report);
    return report;
  }

  public Object importKitchen(Actor a, UUID rid, UUID sid, RemoteBill remote) {
    manager(a, rid);
    validateRemote(rid, sid, remote);
    var s =
        db.one("SELECT * FROM table_session WHERE restaurant_id=? AND id=? FOR UPDATE", rid, sid);
    db.one("SELECT session_id FROM pos_session WHERE restaurant_id=? AND session_id=?", rid, sid);
    if (!"OPEN".equals(Db.text(s, "status")))
      throw Problem.conflict("Closed sessions do not accept kitchen updates.");
    int changed = 0;
    var order = List.of("ACCEPTED", "PREPARING", "READY", "SERVED");
    for (var e : remote.kitchenStatuses().entrySet()) {
      if (!order.contains(e.getValue()))
        throw Problem.conflict(
            "Unsupported kitchen state. Staff must resolve cancellations/rejections explicitly.");
      var item =
          db.one(
              "SELECT status FROM order_item WHERE restaurant_id=? AND session_id=? AND id=?",
              rid,
              sid,
              e.getKey());
      int old = order.indexOf(Db.text(item, "status")), next = order.indexOf(e.getValue());
      if (old >= 0 && next > old) {
        db.update("UPDATE order_item SET status=? WHERE id=?", e.getValue(), e.getKey());
        changed++;
      }
    }
    if (changed > 0) sessions.event(a, s, "POS_KITCHEN_IMPORTED", Map.of("changed", changed));
    return Map.of("changed", changed);
  }

  private void validateRemote(UUID rid, UUID sid, RemoteBill r) {
    if (r == null
        || !rid.equals(r.restaurantId())
        || !sid.equals(r.sessionId())
        || r.bill() == null
        || !rid.equals(r.bill().restaurantId())
        || !sid.equals(r.bill().sessionId())
        || r.externalBillId() == null
        || r.kitchenStatuses() == null)
      throw Problem.conflict("The POS returned a bill for a different restaurant or session.");
  }

  public Object mockMode(Actor a, UUID rid, String mode) {
    manager(a, rid);
    mock();
    if (db.update("UPDATE mock_pos_account SET failure_mode=? WHERE restaurant_id=?", mode, rid)
        != 1) throw Problem.missing();
    audit(a, rid, null, "POS_TEST_MODE_CHANGED", Map.of("mode", mode));
    return Map.of("mode", mode);
  }

  public Object mockProduct(Actor a, UUID rid, UUID pid, long price, boolean available) {
    manager(a, rid);
    mock();
    var row = db.one("SELECT * FROM mock_pos_account WHERE restaurant_id=? FOR UPDATE", rid);
    var source = snapshots.convert(row.get("catalog"), Catalog.class);
    String ref = snapshots.mapping(rid, "PRODUCT", pid);
    if (source.products().stream().noneMatch(p -> p.externalId().equals(ref)))
      throw Problem.missing();
    var products =
        source.products().stream()
            .map(
                p ->
                    p.externalId().equals(ref)
                        ? new Product(
                            p.externalId(),
                            p.categoryRef(),
                            p.categoryNames(),
                            p.names(),
                            p.descriptions(),
                            p.allergens(),
                            p.dietaryLabels(),
                            price,
                            available,
                            p.groups())
                        : p)
            .toList();
    var next = new Catalog(Db.amount(row, "catalog_revision") + 1, products);
    db.update(
        "UPDATE mock_pos_account SET catalog_revision=?,catalog=?::jsonb WHERE restaurant_id=?",
        next.revision(),
        db.json(next),
        rid);
    audit(
        a,
        rid,
        null,
        "POS_TEST_PRODUCT_CHANGED",
        Map.of("productId", pid, "priceBani", price, "available", available));
    return Map.of("revision", next.revision());
  }

  public Object mockBill(Actor a, UUID rid, UUID sid, UUID item, String status, long offset) {
    manager(a, rid);
    mock();
    var row =
        db.one(
            "SELECT * FROM mock_pos_bill WHERE restaurant_id=? AND session_id=? FOR UPDATE",
            rid,
            sid);
    Map<String, Object> statuses = new LinkedHashMap<>();
    ((Map<?, ?>) row.get("kitchen_statuses")).forEach((k, v) -> statuses.put(k.toString(), v));
    if (item != null) {
      var bill = snapshots.convert(row.get("payload"), Bill.class);
      if (bill.lines().stream().noneMatch(l -> l.id().equals(item)))
        throw Problem.bad("The TEST POS has not received that item.");
      statuses.put(item.toString(), status);
    }
    db.update(
        "UPDATE mock_pos_bill SET kitchen_statuses=?::jsonb,total_offset_bani=? WHERE"
            + " restaurant_id=? AND session_id=?",
        db.json(statuses),
        offset,
        rid,
        sid);
    audit(a, rid, sid, "POS_TEST_BILL_CHANGED", Map.of("offsetBani", offset));
    return Map.of("updated", true);
  }
}

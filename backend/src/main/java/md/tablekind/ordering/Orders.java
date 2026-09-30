package md.tablekind.ordering;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.*;
import md.tablekind.common.*;
import md.tablekind.restaurant.CatalogService;
import md.tablekind.session.Sessions;
import org.springframework.stereotype.Service;

@Service
public class Orders {
  private final Db db;
  private final Access access;
  private final Sessions sessions;
  private final CatalogService catalog;
  private final Ledger ledger;

  public Orders(Db db, Access access, Sessions sessions, CatalogService catalog, Ledger ledger) {
    this.db = db;
    this.access = access;
    this.sessions = sessions;
    this.catalog = catalog;
    this.ledger = ledger;
  }

  public Object submit(Actor a, UUID sid, OrderController.Submit request) {
    var s = sessions.lock(a, sid, request.revision());
    UUID rid = Db.id(s, "restaurant_id");
    if (a.guest()
        && db.number(
                "SELECT count(*) FROM dining_table t JOIN branch b ON b.id=t.branch_id WHERE t.id=?"
                    + " AND b.operating_mode='PAY_AT_TABLE'",
                Db.id(s, "table_id"))
            > 0)
      throw Problem.conflict(
          "This restaurant takes orders through staff. You can still split and pay here.");
    UUID payer = a.guest() ? a.id() : request.orderedBy();
    if (a.staff()) access.staff(a, rid);
    activeGuest(sid, payer);
    UUID served = request.servedTo() == null ? payer : request.servedTo();
    activeGuest(sid, served);
    catalog.requireOpen(Db.id(s, "table_id"));
    if (db.number("SELECT count(*) FROM order_item WHERE session_id=?", sid) >= 200)
      throw Problem.conflict("This session reached its 200-item limit.");
    var p =
        db.one(
            "SELECT * FROM product WHERE restaurant_id=? AND id=? FOR SHARE",
            rid,
            request.productId());
    if (!Db.bool(p, "available")) throw Problem.conflict("This product is unavailable.");
    if (Db.amount(p, "version") != request.productVersion())
      throw Problem.conflict("The menu changed. Review the current price and options.");
    var options = request.optionIds();
    if (new HashSet<>(options).size() != options.size())
      throw Problem.bad("Select each option only once.");
    Set<UUID> acceptedOptions = new HashSet<>();
    List<Object> snapshots = new ArrayList<>();
    long unit = Db.amount(p, "price_bani");
    for (var g :
        db.list(
            "SELECT * FROM modifier_group WHERE restaurant_id=? AND product_id=? ORDER BY id",
            rid,
            request.productId())) {
      int count = 0;
      for (var o :
          db.list(
              "SELECT * FROM modifier_option WHERE restaurant_id=? AND group_id=? ORDER BY id",
              rid,
              Db.id(g, "id"))) {
        UUID oid = Db.id(o, "id");
        if (!options.contains(oid)) continue;
        if (!Db.bool(o, "available"))
          throw Problem.conflict("One of the selected options is unavailable.");
        acceptedOptions.add(oid);
        count++;
        unit = Math.addExact(unit, Db.amount(o, "price_bani"));
        snapshots.add(o);
      }
      if (count < Db.amount(g, "min_select") || count > Db.amount(g, "max_select"))
        throw Problem.bad("Choose the required number of options for each modifier group.");
    }
    if (acceptedOptions.size() != options.size())
      throw Problem.bad("An option does not belong to this product.");
    long amount = Math.multiplyExact(unit, request.quantity());
    if (amount > Money.MAX) throw Problem.bad("This order is too large.");
    UUID item = UUID.randomUUID();
    var snapshot =
        Map.of("names", p.get("names"), "allergens", p.get("allergens"), "options", snapshots);
    db.update(
        "INSERT INTO"
            + " order_item(id,restaurant_id,session_id,product_id,ordered_by,served_to,quantity,unit_price_bani,product_version,snapshot,status,note)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?::jsonb,'SUBMITTED',?)",
        item,
        rid,
        sid,
        request.productId(),
        payer,
        served,
        request.quantity(),
        unit,
        request.productVersion(),
        db.json(snapshot),
        request.note());
    if (!Db.bool(
        db.one(
            "SELECT b.approval_required FROM branch b JOIN dining_table t ON t.branch_id=b.id WHERE"
                + " t.id=?",
            Db.id(s, "table_id")),
        "approval_required")) accept(rid, sid, item);
    sessions.event(
        a, s, "ORDER_SUBMITTED", Map.of("itemId", item, "amountBani", amount, "servedTo", served));
    return db.one("SELECT * FROM order_item WHERE id=?", item);
  }

  public Object status(Actor a, UUID sid, UUID item, OrderController.Status request) {
    authorizeStatus(a, sid, item, request);
    var s = sessions.lock(a, sid, request.revision());
    UUID rid = Db.id(s, "restaurant_id");
    var row = db.one("SELECT * FROM order_item WHERE session_id=? AND id=?", sid, item);
    String old = Db.text(row, "status"), next = request.status();
    if (a.guest()) {
      if (!a.id().equals(Db.id(row, "ordered_by"))
          || !next.equals("CANCELLED")
          || !old.equals("SUBMITTED")) throw Problem.forbidden();
    } else access.staff(a, rid);
    boolean allowed =
        switch (old) {
          case "SUBMITTED" -> Set.of("ACCEPTED", "REJECTED", "CANCELLED").contains(next);
          case "ACCEPTED" -> Set.of("PREPARING", "CANCELLED").contains(next);
          case "PREPARING" -> Set.of("READY", "CANCELLED").contains(next);
          case "READY" -> Set.of("SERVED", "CANCELLED").contains(next);
          default -> false;
        };
    if (!allowed) throw Problem.conflict("That order status transition is not allowed.");
    if (next.equals("ACCEPTED")) {
      var p =
          db.one(
              "SELECT * FROM product WHERE restaurant_id=? AND id=? FOR SHARE",
              rid,
              Db.id(row, "product_id"));
      if (!Db.bool(p, "available") || Db.amount(p, "version") != Db.amount(row, "product_version"))
        throw Problem.conflict(
            "The menu or availability changed. Reject this item and request a new order.");
      accept(rid, sid, item);
    } else {
      if (next.equals("CANCELLED") && !old.equals("SUBMITTED")) {
        if (Set.of("PREPARING", "READY").contains(old)) access.manager(a, rid);
        if (request.reason().isBlank())
          throw Problem.bad("Give a reason for cancelling an accepted item.");
        ledger.editable(sid, item);
        UUID batch = UUID.randomUUID();
        long total = ledger.total(sid, item);
        ledger.charge(rid, sid, item, -total, "CANCELLATION", request.reason(), batch);
        ledger.replace(rid, sid, item, Map.of(), request.reason(), batch);
      }
      db.update("UPDATE order_item SET status=? WHERE id=?", next, item);
    }
    sessions.event(a, s, "ORDER_" + next, Map.of("itemId", item, "reason", request.reason()));
    return Map.of("id", item, "status", next);
  }

  /** Apply before receipt replay too. Accepted-item cancellation is a manager correction. */
  public void authorizeStatus(Actor a, UUID sid, UUID item, OrderController.Status request) {
    var s = access.session(a, sid);
    var row =
        db.one(
            "SELECT status,ordered_by,EXISTS(SELECT 1 FROM bill_entry WHERE item_id=i.id) AS"
                + " ever_accepted FROM order_item i WHERE session_id=? AND id=?",
            sid,
            item);
    if (a.guest()) {
      if (!a.id().equals(Db.id(row, "ordered_by")) || !request.status().equals("CANCELLED"))
        throw Problem.forbidden();
    } else if (request.status().equals("CANCELLED")) {
      // Cancellation changes the current status. Immutable charge history distinguishes
      // a submitted-item receipt from a manager correction, including zero-priced items.
      boolean submittedCancellation =
          Db.text(row, "status").equals("SUBMITTED")
              || (Db.text(row, "status").equals("CANCELLED") && !Db.bool(row, "ever_accepted"));
      if (!submittedCancellation) access.manager(a, Db.id(s, "restaurant_id"));
    }
  }

  private void accept(UUID rid, UUID sid, UUID item) {
    var row = db.one("SELECT * FROM order_item WHERE id=?", item);
    UUID batch = UUID.randomUUID();
    long amount = Math.multiplyExact(Db.amount(row, "unit_price_bani"), Db.amount(row, "quantity"));
    if (db.number("SELECT coalesce(sum(amount_bani),0) FROM bill_entry WHERE session_id=?", sid)
            + amount
        > Money.MAX) throw Problem.conflict("This table exceeds the supported bill limit.");
    ledger.charge(rid, sid, item, amount, "ITEM", "Accepted order", batch);
    ledger.allocate(
        rid,
        sid,
        item,
        Db.id(row, "ordered_by"),
        amount,
        "Initial responsibility of the person placing the order",
        batch);
    db.update("UPDATE order_item SET status='ACCEPTED' WHERE id=?", item);
  }

  private void activeGuest(UUID sid, UUID guest) {
    if (guest == null
        || db.number(
                "SELECT count(*) FROM guest WHERE id=? AND session_id=? AND active", guest, sid)
            != 1) throw Problem.bad("Choose an active guest from this table.");
  }
}

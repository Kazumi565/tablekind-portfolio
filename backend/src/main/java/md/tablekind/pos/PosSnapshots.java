package md.tablekind.pos;

import static md.tablekind.pos.PosConnector.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import md.tablekind.common.*;
import org.springframework.stereotype.Component;

@Component
public class PosSnapshots {
  private final Db db;
  private final ObjectMapper json;
  private static final TypeReference<Map<String, String>> NAMES = new TypeReference<>() {};

  public PosSnapshots(Db db, ObjectMapper json) {
    this.db = db;
    this.json = json;
  }

  public <T> T convert(Object value, Class<T> type) {
    return json.convertValue(value, type);
  }

  public String mapping(UUID rid, String kind, UUID local) {
    return db.optional(
            "SELECT external_id FROM pos_mapping WHERE restaurant_id=? AND kind=? AND local_id=?",
            rid,
            kind,
            local)
        .map(r -> Db.text(r, "external_id"))
        .orElse("UNMAPPED:" + local);
  }

  public Bill bill(UUID rid, UUID sid) {
    var s =
        db.one(
            "SELECT s.*,t.label FROM table_session s JOIN dining_table t ON t.id=s.table_id WHERE"
                + " s.restaurant_id=? AND s.id=?",
            rid,
            sid);
    List<Line> lines = new ArrayList<>();
    for (var i :
        db.list(
            "SELECT i.* FROM order_item i WHERE i.session_id=? AND EXISTS(SELECT 1 FROM bill_entry"
                + " b WHERE b.item_id=i.id) ORDER BY i.id",
            sid)) {
      UUID id = Db.id(i, "id");
      var snapshot = json.valueToTree(i.get("snapshot"));
      List<Choice> options = new ArrayList<>();
      for (var o : snapshot.path("options"))
        options.add(
            new Choice(
                mapping(rid, "OPTION", UUID.fromString(o.path("id").asText())),
                json.convertValue(o.path("names"), NAMES),
                o.path("price_bani").asLong()));
      var charges =
          db
              .list(
                  "SELECT id,amount_bani,kind,reason FROM bill_entry WHERE item_id=? ORDER BY id",
                  id)
              .stream()
              .map(
                  c ->
                      new Charge(
                          Db.id(c, "id"),
                          Db.amount(c, "amount_bani"),
                          Db.text(c, "kind"),
                          Db.text(c, "reason")))
              .toList();
      lines.add(
          new Line(
              id,
              mapping(rid, "PRODUCT", Db.id(i, "product_id")),
              json.convertValue(snapshot.path("names"), NAMES),
              (int) Db.amount(i, "quantity"),
              Db.amount(i, "unit_price_bani"),
              charges.stream().mapToLong(Charge::amountBani).sum(),
              Db.text(i, "status"),
              Db.text(i, "note"),
              options,
              charges));
    }
    var tenders =
        db
            .list(
                "SELECT * FROM payment_attempt WHERE session_id=? AND status='SUCCEEDED' ORDER BY"
                    + " id",
                sid)
            .stream()
            .map(
                p ->
                    new Tender(
                        Db.id(p, "id"),
                        Db.text(p, "method"),
                        Db.amount(p, "amount_bani"),
                        Db.amount(p, "tip_bani"),
                        Db.bool(p, "is_test"),
                        Db.text(p, "manual_reference")))
            .toList();
    var refunds =
        db
            .list(
                "SELECT * FROM payment_refund WHERE session_id=? AND status='SUCCEEDED' ORDER BY"
                    + " id",
                sid)
            .stream()
            .map(
                r ->
                    new Refund(
                        Db.id(r, "id"),
                        Db.id(r, "payment_id"),
                        Db.amount(r, "amount_bani"),
                        Db.amount(r, "tip_bani"),
                        Db.text(r, "mode"),
                        Db.text(r, "reason")))
            .toList();
    return new Bill(
        rid,
        sid,
        mapping(rid, "TABLE", Db.id(s, "table_id")),
        Db.text(s, "label"),
        "MDL",
        Db.text(s, "status"),
        lines,
        tenders,
        refunds,
        lines.stream().mapToLong(Line::totalBani).sum(),
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM settlement_entry WHERE session_id=?", sid),
        tenders.stream().mapToLong(Tender::tipBani).sum()
            - refunds.stream().mapToLong(Refund::tipBani).sum());
  }

  /** Called while the session lock is held, in the same transaction as the business change. */
  public void capture(UUID rid, UUID sid) {
    var tracked =
        db.optional("SELECT * FROM pos_session WHERE restaurant_id=? AND session_id=?", rid, sid);
    if (tracked.isEmpty()) return;
    var bill = bill(rid, sid);
    String payload = db.json(bill), hash = Commands.hash(payload);
    if (hash.equals(Db.text(tracked.get(), "last_hash"))) return;
    long revision = db.number("SELECT revision FROM table_session WHERE id=?", sid);
    db.update(
        "INSERT INTO pos_outbox(id,restaurant_id,session_id,revision,payload,fingerprint)"
            + " VALUES(?,?,?,?,?::jsonb,?)",
        UUID.randomUUID(),
        rid,
        sid,
        revision,
        payload,
        hash);
    db.update("UPDATE pos_session SET last_hash=? WHERE session_id=?", hash, sid);
  }

  public void track(UUID rid, UUID sid) {
    if (db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) == 1)
      db.update("INSERT INTO pos_session(restaurant_id,session_id) VALUES(?,?)", rid, sid);
  }
}

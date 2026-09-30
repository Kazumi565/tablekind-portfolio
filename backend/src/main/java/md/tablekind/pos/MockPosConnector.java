package md.tablekind.pos;

import static md.tablekind.pos.PosConnector.*;

import java.util.*;
import md.tablekind.common.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;

/** Persistent test double, not a bank, kitchen system or fiscal receipt service. */
@Component
@Profile({"local", "demo"})
public class MockPosConnector implements PosConnector {
  private final Db db;
  private final PosSnapshots snapshots;
  private final TransactionTemplate tx;

  public MockPosConnector(Db db, PosSnapshots snapshots, PlatformTransactionManager manager) {
    this.db = db;
    this.snapshots = snapshots;
    this.tx = new TransactionTemplate(manager);
  }

  public String name() {
    return "MOCK";
  }

  public boolean testOnly() {
    return true;
  }

  private Map<String, Object> account(UUID rid) {
    return db.one("SELECT * FROM mock_pos_account WHERE restaurant_id=?", rid);
  }

  private void online(Map<String, Object> account) {
    if (Db.text(account, "failure_mode").equals("OFFLINE"))
      throw new Failure("TEST POS is offline. Delivery will retry.", true);
  }

  public Receipt apply(Command c) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("Remote work must run outside a business transaction");
    boolean[] lose = {false};
    Receipt receipt =
        tx.execute(
            status -> {
              var a =
                  db.one(
                      "SELECT * FROM mock_pos_account WHERE restaurant_id=? FOR UPDATE",
                      c.restaurantId());
              online(a);
              var prior =
                  db.optional(
                      "SELECT fingerprint,response FROM mock_pos_receipt WHERE restaurant_id=? AND"
                          + " command_id=?",
                      c.restaurantId(),
                      c.id());
              if (prior.isPresent()) {
                if (!c.fingerprint().equals(Db.text(prior.get(), "fingerprint")))
                  throw new Failure(
                      "POS rejected reused command identity with changed content.", false);
                return snapshots.convert(prior.get().get("response"), Receipt.class);
              }
              if (Db.text(a, "failure_mode").equals("REJECT"))
                throw new Failure("TEST POS rejected the bill. Manager review required.", false);
              var b = c.bill();
              if (!c.restaurantId().equals(b.restaurantId())
                  || !c.sessionId().equals(b.sessionId())
                  || !"MDL".equals(b.currency())
                  || !Commands.hash(db.json(b)).equals(c.fingerprint()))
                throw new Failure("POS command identity or currency does not match.", false);
              if (b.tableRef().startsWith("UNMAPPED:")
                  || b.lines().stream()
                      .anyMatch(
                          l ->
                              l.productRef().startsWith("UNMAPPED:")
                                  || l.options().stream()
                                      .anyMatch(o -> o.externalId().startsWith("UNMAPPED:"))))
                throw new Failure("POS mapping is missing. Manager review required.", false);
              long paid =
                  b.payments().stream().mapToLong(Tender::amountBani).sum()
                      - b.refunds().stream().mapToLong(Refund::amountBani).sum();
              if (paid != b.paidBani()
                  || b.lines().stream().mapToLong(Line::totalBani).sum() != b.totalBani())
                throw new Failure(
                    "POS bill contains an unlinked settlement or inconsistent amounts.", false);
              var old =
                  db.optional(
                      "SELECT * FROM mock_pos_bill WHERE restaurant_id=? AND session_id=?",
                      c.restaurantId(),
                      c.sessionId());
              if (old.isPresent() && Db.amount(old.get(), "revision") >= c.revision())
                throw new Failure(
                    "POS has a conflicting or newer revision. Reconcile before retrying.", false);
              String external = "TEST-BILL-" + c.sessionId();
              for (var l : b.lines())
                db.update(
                    "INSERT INTO mock_pos_kitchen_ticket(restaurant_id,session_id,item_id)"
                        + " VALUES(?,?,?) ON CONFLICT DO NOTHING",
                    c.restaurantId(),
                    c.sessionId(),
                    l.id());
              db.update(
                  "INSERT INTO"
                      + " mock_pos_bill(restaurant_id,session_id,revision,external_bill_id,payload)"
                      + " VALUES(?,?,?,?,?::jsonb) ON CONFLICT(restaurant_id,session_id) DO UPDATE"
                      + " SET revision=excluded.revision,payload=excluded.payload",
                  c.restaurantId(),
                  c.sessionId(),
                  c.revision(),
                  external,
                  db.json(b));
              var result =
                  new Receipt(
                      c.id(),
                      c.restaurantId(),
                      c.sessionId(),
                      c.revision(),
                      c.fingerprint(),
                      external);
              db.update(
                  "INSERT INTO mock_pos_receipt(restaurant_id,command_id,fingerprint,response)"
                      + " VALUES(?,?,?,?::jsonb)",
                  c.restaurantId(),
                  c.id(),
                  c.fingerprint(),
                  db.json(result));
              if (Db.text(a, "failure_mode").equals("LOSE_REPLY")) {
                lose[0] = true;
                db.update(
                    "UPDATE mock_pos_account SET failure_mode='ONLINE' WHERE restaurant_id=?",
                    c.restaurantId());
              }
              return result;
            });
    // Commit the remote effect first: precisely the ambiguous-success failure we must recover.
    if (lose[0])
      throw new Failure(
          "TEST POS accepted the command, but its reply was lost. Retrying the same identity.",
          true);
    return receipt;
  }

  public RemoteBill readBill(UUID rid, UUID sid) {
    online(account(rid));
    var row =
        db.optional("SELECT * FROM mock_pos_bill WHERE restaurant_id=? AND session_id=?", rid, sid);
    if (row.isEmpty()) throw new Failure("The TEST POS has not received this bill yet.", true);
    var r = row.get();
    var b = snapshots.convert(r.get("payload"), Bill.class);
    var adjusted =
        new Bill(
            b.restaurantId(),
            b.sessionId(),
            b.tableRef(),
            b.tableLabel(),
            b.currency(),
            b.status(),
            b.lines(),
            b.payments(),
            b.refunds(),
            b.totalBani() + Db.amount(r, "total_offset_bani"),
            b.paidBani(),
            b.tipBani());
    Map<UUID, String> statuses = new LinkedHashMap<>();
    ((Map<?, ?>) r.get("kitchen_statuses"))
        .forEach((k, v) -> statuses.put(UUID.fromString(k.toString()), v.toString()));
    return new RemoteBill(
        rid, sid, Db.amount(r, "revision"), Db.text(r, "external_bill_id"), adjusted, statuses);
  }

  public Catalog readCatalog(UUID rid) {
    var a = account(rid);
    online(a);
    var c = snapshots.convert(a.get("catalog"), Catalog.class);
    return new Catalog(Db.amount(a, "catalog_revision"), c.products());
  }
}

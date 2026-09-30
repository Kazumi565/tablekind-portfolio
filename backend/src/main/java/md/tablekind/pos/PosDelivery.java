package md.tablekind.pos;

import static md.tablekind.pos.PosConnector.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import md.tablekind.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PosDelivery {
  private final Db db;
  private final PosSnapshots snapshots;
  public static final UUID SYSTEM = UUID.fromString("00000000-0000-0000-0000-000000000006");

  public PosDelivery(Db db, PosSnapshots snapshots) {
    this.db = db;
    this.snapshots = snapshots;
  }

  public record Lease(UUID token, Command command, int attempts) {}

  @Transactional
  public Lease claim(UUID rid) {
    var expired =
        db.list(
            "UPDATE pos_outbox SET"
                + " status='FAILED',lease_token=NULL,lease_until=NULL,last_error='Delivery outcome"
                + " uncertain after repeated worker interruptions. Reconcile and retry the same"
                + " command.' WHERE status='IN_FLIGHT' AND lease_until<now() AND cycle_attempts>=8"
                + " RETURNING id,restaurant_id,session_id");
    for (var row : expired)
      audit(
          Db.id(row, "restaurant_id"),
          Db.id(row, "session_id"),
          "POS_REVIEW_REQUIRED",
          Map.of(
              "messageId",
              row.get("id"),
              "reason",
              "Worker lease expired after the last automatic attempt."));
    var rows =
        db.list(
            "SELECT o.* FROM pos_outbox o JOIN pos_connection c ON c.restaurant_id=o.restaurant_id"
                + " WHERE NOT c.paused AND (?::uuid IS NULL OR o.restaurant_id=?::uuid) AND"
                + " o.cycle_attempts<8 AND ((o.status IN('PENDING','RETRY') AND"
                + " o.available_at<=now()) OR (o.status='IN_FLIGHT' AND o.lease_until<now())) AND"
                + " NOT EXISTS(SELECT 1 FROM pos_outbox earlier WHERE"
                + " earlier.session_id=o.session_id AND earlier.sequence<o.sequence AND"
                + " earlier.status<>'DELIVERED') ORDER BY o.sequence LIMIT 1 FOR UPDATE OF o SKIP"
                + " LOCKED",
            rid,
            rid);
    if (rows.isEmpty()) return null;
    var r = rows.getFirst();
    UUID token = UUID.randomUUID(), id = Db.id(r, "id");
    db.update(
        "UPDATE pos_outbox SET"
            + " status='IN_FLIGHT',attempts=attempts+1,cycle_attempts=cycle_attempts+1,lease_token=?,lease_until=now()+interval"
            + " '45 seconds' WHERE id=?",
        token,
        id);
    return new Lease(
        token,
        new Command(
            id,
            Db.id(r, "restaurant_id"),
            Db.id(r, "session_id"),
            Db.amount(r, "revision"),
            Db.text(r, "fingerprint"),
            snapshots.convert(r.get("payload"), Bill.class)),
        (int) Db.amount(r, "cycle_attempts") + 1);
  }

  @Transactional
  public void acknowledge(Lease lease, Receipt receipt) {
    var c = lease.command();
    if (receipt == null
        || !c.id().equals(receipt.commandId())
        || !c.restaurantId().equals(receipt.restaurantId())
        || !c.sessionId().equals(receipt.sessionId())
        || c.revision() != receipt.revision()
        || !c.fingerprint().equals(receipt.fingerprint())
        || receipt.externalBillId() == null
        || receipt.externalBillId().isBlank()
        || receipt.externalBillId().length() > 160)
      throw new Failure(
          "POS acknowledgment identity does not match the command. Review required.", false);
    if (db.update(
            "UPDATE pos_outbox SET"
                + " status='DELIVERED',delivered_at=now(),lease_token=NULL,lease_until=NULL,last_error=NULL"
                + " WHERE id=? AND status='IN_FLIGHT' AND lease_token=?",
            c.id(),
            lease.token())
        != 1) return;
    // Catalog import also locks connection before product/session work. Keep that order here.
    db.update(
        "UPDATE pos_connection SET last_success_at=now(),last_error=NULL WHERE restaurant_id=?",
        c.restaurantId());
    db.update(
        "UPDATE pos_session SET delivered_revision=?,external_bill_id=?,last_synced_at=now() WHERE"
            + " session_id=?",
        c.revision(),
        receipt.externalBillId(),
        c.sessionId());
    audit(
        c.restaurantId(),
        c.sessionId(),
        "POS_DELIVERED",
        Map.of("messageId", c.id(), "revision", c.revision()));
  }

  @Transactional
  public void failed(Lease lease, String message, boolean retryable) {
    var c = lease.command();
    message = Objects.toString(message, "POS outcome could not be confirmed.");
    if (message.length() > 400) message = message.substring(0, 400);
    boolean retry = retryable && lease.attempts() < 8;
    long delay = Math.min(300, 2L << Math.min(lease.attempts() - 1, 7));
    if (db.update(
            "UPDATE pos_outbox SET"
                + " status=?,available_at=?,lease_token=NULL,lease_until=NULL,last_error=? WHERE"
                + " id=? AND status='IN_FLIGHT' AND lease_token=?",
            retry ? "RETRY" : "FAILED",
            Timestamp.from(Instant.now().plusSeconds(delay)),
            message,
            c.id(),
            lease.token())
        != 1) return;
    db.update(
        "UPDATE pos_connection SET last_error=? WHERE restaurant_id=?", message, c.restaurantId());
    audit(
        c.restaurantId(),
        c.sessionId(),
        retry ? "POS_RETRY_SCHEDULED" : "POS_REVIEW_REQUIRED",
        Map.of("messageId", c.id(), "reason", message));
  }

  public void audit(UUID rid, UUID sid, String action, Object detail) {
    db.update(
        "INSERT INTO audit_event(restaurant_id,session_id,actor_id,action,detail)"
            + " VALUES(?,?,?,?,?::jsonb)",
        rid,
        sid,
        SYSTEM,
        action,
        db.json(detail));
  }
}

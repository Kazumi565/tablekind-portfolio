package md.tablekind.billing;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.session.Sessions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class Allocations {
  private final Db db;
  private final Access access;
  private final Sessions sessions;
  private final Ledger ledger;
  private final int holdSeconds;

  public Allocations(
      Db db,
      Access access,
      Sessions sessions,
      Ledger ledger,
      @Value("${tablekind.checkout-hold-seconds}") int holdSeconds) {
    this.db = db;
    this.access = access;
    this.sessions = sessions;
    this.ledger = ledger;
    this.holdSeconds = holdSeconds;
  }

  public Object split(Actor a, UUID sid, UUID item, BillingController.Split r) {
    var s = sessions.lock(a, sid, r.revision());
    var row = acceptedItem(sid, item);
    ledger.editable(sid, item);
    if (a.guest()
        && !ledger.shares(sid, item).containsKey(a.id())
        && !a.id().equals(Db.id(row, "ordered_by"))) throw Problem.forbidden();
    Map<UUID, Long> target;
    long total = ledger.total(sid, item);
    if (total == 0) throw Problem.bad("There is no balance to split on this item.");
    List<UUID> ids = r.shares().stream().map(BillingController.Share::guestId).toList();
    validateGuests(sid, ids);
    Map<UUID, Long> values = new LinkedHashMap<>();
    r.shares().forEach(x -> values.put(x.guestId(), x.value()));
    target =
        switch (r.mode()) {
          case "EQUAL" -> Money.equal(total, ids);
          case "PROPORTION" -> {
            if (values.values().stream().mapToLong(Long::longValue).sum() != 10000)
              throw Problem.bad("Proportions must sum to 10,000 basis points (100%).");
            yield Money.weighted(total, values);
          }
          case "QUANTITY" -> {
            if (r.totalUnits() == null
                || r.totalUnits() < 1
                || values.values().stream().mapToLong(Long::longValue).sum() != r.totalUnits())
              throw Problem.bad("The quantities must sum to the declared number of portions.");
            yield Money.weighted(total, values);
          }
          case "AMOUNTS" -> {
            if (values.values().stream().mapToLong(Long::longValue).sum() != total)
              throw Problem.bad("Custom amounts must add up to the item's full total.");
            yield values;
          }
          default -> throw Problem.bad("Unknown split mode.");
        };
    return propose(a, s, "ITEM_" + r.mode(), Map.of(item, target), null, r.reason());
  }

  public Object transfer(Actor a, UUID sid, UUID item, BillingController.Transfer r) {
    var s = sessions.lock(a, sid, r.revision());
    var row = acceptedItem(sid, item);
    ledger.editable(sid, item);
    validateGuests(sid, List.of(r.guestId()));
    if (a.guest()
        && !a.id().equals(Db.id(row, "served_to"))
        && !a.id().equals(Db.id(row, "ordered_by"))) throw Problem.forbidden();
    return propose(
        a,
        s,
        "TRANSFER",
        Map.of(item, Map.of(r.guestId(), ledger.total(sid, item))),
        r.guestId(),
        r.reason());
  }

  public Object takeover(Actor a, UUID sid, UUID item, long revision) {
    var s = sessions.lock(a, sid, revision);
    access.guest(a, sid);
    acceptedItem(sid, item);
    ledger.editable(sid, item);
    ledger.replace(
        Db.id(s, "restaurant_id"),
        sid,
        item,
        Map.of(a.id(), ledger.total(sid, item)),
        "Voluntary takeover",
        UUID.randomUUID());
    sessions.event(a, s, "ITEM_COVERED", Map.of("itemId", item, "guestId", a.id()));
    return Map.of("itemId", item);
  }

  public Object tableEqual(Actor a, UUID sid, BillingController.TableSplit r) {
    var s = sessions.lock(a, sid, r.revision());
    validateGuests(sid, r.guestIds());
    if (db.number("SELECT count(*) FROM order_item WHERE session_id=? AND status='SUBMITTED'", sid)
        > 0)
      throw Problem.conflict("Accept or reject submitted orders before splitting the whole table.");
    List<UUID> items =
        db
            .list(
                "SELECT id FROM order_item WHERE session_id=? AND status"
                    + " IN('ACCEPTED','PREPARING','READY','SERVED') ORDER BY id",
                sid)
            .stream()
            .map(x -> Db.id(x, "id"))
            .toList();
    for (UUID id : items) ledger.editable(sid, id);
    long total = items.stream().mapToLong(id -> ledger.total(sid, id)).sum();
    if (total == 0) throw Problem.bad("There is no bill to split.");
    var remaining = new TreeMap<UUID, Long>(Comparator.comparing(UUID::toString));
    remaining.putAll(Money.equal(total, r.guestIds()));
    Map<UUID, Map<UUID, Long>> matrix = new LinkedHashMap<>();
    // Preserve each row total and each guest's target exactly, including rounding.
    for (UUID item : items) {
      long left = ledger.total(sid, item);
      Map<UUID, Long> shares = new LinkedHashMap<>();
      for (UUID guest : remaining.keySet()) {
        long take = Math.min(left, remaining.get(guest));
        if (take > 0) shares.put(guest, take);
        remaining.put(guest, remaining.get(guest) - take);
        left -= take;
      }
      matrix.put(item, shares);
    }
    return propose(
        a, s, "TABLE_EQUAL", matrix, null, "Equal split of the current accepted table bill");
  }

  private Object propose(
      Actor a,
      Map<String, Object> session,
      String kind,
      Map<UUID, Map<UUID, Long>> matrix,
      UUID newOwner,
      String reason) {
    UUID sid = Db.id(session, "id"), rid = Db.id(session, "restaurant_id"), pid = UUID.randomUUID();
    Set<UUID> required = new TreeSet<>(Comparator.comparing(UUID::toString));
    for (var entry : matrix.entrySet()) {
      required.addAll(ledger.shares(sid, entry.getKey()).keySet());
      entry
          .getValue()
          .forEach(
              (g, v) -> {
                if (v > 0) required.add(g);
              });
    }
    if (newOwner != null) {
      required.add(newOwner);
      for (UUID item : matrix.keySet()) required.add(Db.id(acceptedItem(sid, item), "served_to"));
    }
    if (required.isEmpty()) throw Problem.bad("There is no financial responsibility to change.");
    db.update(
        "INSERT INTO"
            + " allocation_proposal(id,restaurant_id,session_id,kind,proposed_by,new_owner,status,reason)"
            + " VALUES(?,?,?,?,?,?,'PENDING',?)",
        pid,
        rid,
        sid,
        kind,
        a.id(),
        newOwner,
        reason);
    for (var entry : matrix.entrySet()) {
      UUID item = entry.getKey();
      db.update(
          "INSERT INTO proposal_item(restaurant_id,session_id,proposal_id,item_id) VALUES(?,?,?,?)",
          rid,
          sid,
          pid,
          item);
      for (var e : entry.getValue().entrySet())
        db.update(
            "INSERT INTO"
                + " proposed_share(restaurant_id,session_id,proposal_id,item_id,guest_id,amount_bani)"
                + " VALUES(?,?,?,?,?,?)",
            rid,
            sid,
            pid,
            item,
            e.getKey(),
            e.getValue());
    }
    for (UUID guest : required)
      db.update(
          "INSERT INTO proposal_vote(restaurant_id,session_id,proposal_id,guest_id,accepted)"
              + " VALUES(?,?,?,?,?)",
          rid,
          sid,
          pid,
          guest,
          a.guest() && a.id().equals(guest) ? Boolean.TRUE : null);
    applyIfApproved(session, pid);
    sessions.event(a, session, "ALLOCATION_PROPOSED", Map.of("proposalId", pid, "kind", kind));
    return Map.of("proposalId", pid);
  }

  public Object vote(Actor a, UUID sid, UUID pid, BillingController.Vote r) {
    var s = sessions.lock(a, sid, r.revision());
    access.guest(a, sid);
    db.one(
        "SELECT id FROM allocation_proposal WHERE session_id=? AND id=? AND status='PENDING'",
        sid,
        pid);
    if (db.update(
            "UPDATE proposal_vote SET accepted=? WHERE proposal_id=? AND guest_id=? AND accepted IS"
                + " NULL",
            r.accept(),
            pid,
            a.id())
        != 1)
      throw Problem.conflict("This proposal does not need a vote from you, or you already voted.");
    if (!r.accept()) db.update("UPDATE allocation_proposal SET status='DECLINED' WHERE id=?", pid);
    else applyIfApproved(s, pid);
    sessions.event(
        a, s, r.accept() ? "SHARE_APPROVED" : "SHARE_DECLINED", Map.of("proposalId", pid));
    return Map.of("proposalId", pid);
  }

  public Object withdraw(Actor a, UUID sid, UUID pid, long revision) {
    var s = sessions.lock(a, sid, revision);
    var p =
        db.one(
            "SELECT * FROM allocation_proposal WHERE session_id=? AND id=? AND status='PENDING'",
            sid,
            pid);
    if (!a.id().equals(Db.id(p, "proposed_by"))) access.staff(a, Db.id(s, "restaurant_id"));
    db.update("UPDATE allocation_proposal SET status='WITHDRAWN' WHERE id=?", pid);
    sessions.event(a, s, "PROPOSAL_WITHDRAWN", Map.of("proposalId", pid));
    return Map.of("withdrawn", true);
  }

  private void applyIfApproved(Map<String, Object> session, UUID pid) {
    if (db.number(
            "SELECT count(*) FROM proposal_vote WHERE proposal_id=? AND accepted IS DISTINCT FROM"
                + " true",
            pid)
        > 0) return;
    UUID sid = Db.id(session, "id"), rid = Db.id(session, "restaurant_id");
    var proposal = db.one("SELECT * FROM allocation_proposal WHERE id=?", pid);
    for (var row :
        db.list("SELECT item_id FROM proposal_item WHERE proposal_id=? ORDER BY item_id", pid)) {
      UUID item = Db.id(row, "item_id");
      Map<UUID, Long> next = new LinkedHashMap<>();
      for (var share :
          db.list(
              "SELECT guest_id,amount_bani FROM proposed_share WHERE proposal_id=? AND item_id=?",
              pid,
              item)) next.put(Db.id(share, "guest_id"), Db.amount(share, "amount_bani"));
      ledger.replace(rid, sid, item, next, "Approved proposal " + pid, pid);
      if (proposal.get("new_owner") != null)
        db.update(
            "UPDATE order_item SET served_to=? WHERE id=?", Db.id(proposal, "new_owner"), item);
    }
    db.update("UPDATE allocation_proposal SET status='ACCEPTED' WHERE id=?", pid);
  }

  public Object adjustment(Actor a, UUID sid, BillingController.Adjustment r) {
    var s = sessions.lock(a, sid, r.revision());
    UUID rid = Db.id(s, "restaurant_id");
    access.manager(a, rid);
    List<UUID> items =
        r.itemId() == null
            ? db
                .list(
                    "SELECT id FROM order_item WHERE session_id=? AND status"
                        + " IN('ACCEPTED','PREPARING','READY','SERVED') ORDER BY id",
                    sid)
                .stream()
                .map(x -> Db.id(x, "id"))
                .toList()
            : List.of(r.itemId());
    Map<UUID, Long> weights = new LinkedHashMap<>();
    for (UUID item : items) {
      acceptedItem(sid, item);
      ledger.editable(sid, item);
      weights.put(item, ledger.total(sid, item));
    }
    long total = weights.values().stream().mapToLong(Long::longValue).sum();
    if (total == 0) throw Problem.bad("Adjust an accepted item with a positive balance.");
    if ((r.amountBani() == null) == (r.basisPoints() == null))
      throw Problem.bad("Specify either a fixed amount or a percentage, not both.");
    long magnitude =
        r.amountBani() != null
            ? Math.abs(r.amountBani())
            : Money.percentage(total, r.basisPoints());
    boolean negative =
        r.kind().equals("DISCOUNT")
            || (r.kind().equals("CORRECTION") && r.amountBani() != null && r.amountBani() < 0);
    if (!r.kind().equals("CORRECTION") && r.amountBani() != null && r.amountBani() < 0)
      throw Problem.bad("Enter a positive amount. The adjustment type determines its sign.");
    if (magnitude == 0 || magnitude > Money.MAX || (negative && magnitude > total))
      throw Problem.bad("The adjustment would create an invalid balance.");
    long overall =
        db.number("SELECT coalesce(sum(amount_bani),0) FROM bill_entry WHERE session_id=?", sid);
    if (!negative && overall + magnitude > Money.MAX)
      throw Problem.bad("The adjusted bill exceeds the supported limit.");
    var itemDeltas = Money.weighted(magnitude, weights);
    UUID batch = UUID.randomUUID();
    for (UUID item : items) {
      long delta = itemDeltas.get(item) * (negative ? -1 : 1);
      if (delta == 0) continue;
      var current = ledger.shares(sid, item);
      var portions = Money.weighted(Math.abs(delta), current);
      ledger.charge(rid, sid, item, delta, r.kind(), r.reason(), batch);
      for (var p : portions.entrySet())
        ledger.allocate(
            rid, sid, item, p.getKey(), p.getValue() * (negative ? -1 : 1), r.reason(), batch);
    }
    sessions.event(
        a,
        s,
        "BILL_ADJUSTED",
        Map.of(
            "batchId",
            batch,
            "kind",
            r.kind(),
            "amountBani",
            negative ? -magnitude : magnitude,
            "reason",
            r.reason()));
    return Map.of("batchId", batch, "bill", ledger.bill(sid));
  }

  public Object quote(Actor a, UUID sid, BillingController.Checkout r) {
    var s =
        sessions.lock(
            a, sid, r.revision()); // A consistent transactional quote, no write or reservation.
    UUID payer = payer(a, sid, r);
    Set<UUID> targets = targets(sid, payer, r);
    var parts = ledger.plan(sid, targets, r.amountBani());
    return Map.of(
        "payerId",
        payer,
        "amountBani",
        parts.stream().mapToLong(Ledger.Part::amountBani).sum(),
        "parts",
        parts,
        "revision",
        s.get("revision"),
        "moneyCollected",
        false);
  }

  public Object reserve(Actor a, UUID sid, BillingController.Checkout r) {
    var s = sessions.lock(a, sid, r.revision());
    access.guest(a, sid);
    UUID payer = payer(a, sid, r);
    var parts = ledger.plan(sid, targets(sid, payer, r), r.amountBani());
    long amount = parts.stream().mapToLong(Ledger.Part::amountBani).sum();
    UUID id = UUID.randomUUID(), rid = Db.id(s, "restaurant_id");
    Instant expires = Instant.now().plusSeconds(holdSeconds);
    db.update(
        "INSERT INTO"
            + " checkout_reservation(id,restaurant_id,session_id,payer_id,amount_bani,status,expires_at)"
            + " VALUES(?,?,?,?,?,'HELD',?)",
        id,
        rid,
        sid,
        payer,
        amount,
        Timestamp.from(expires));
    for (var p : parts)
      db.update(
          "INSERT INTO"
              + " reservation_part(restaurant_id,session_id,reservation_id,item_id,guest_id,amount_bani)"
              + " VALUES(?,?,?,?,?,?)",
          rid,
          sid,
          id,
          p.itemId(),
          p.guestId(),
          p.amountBani());
    sessions.event(a, s, "CHECKOUT_RESERVED", Map.of("reservationId", id, "amountBani", amount));
    return Map.of(
        "reservationId",
        id,
        "payerId",
        payer,
        "amountBani",
        amount,
        "parts",
        parts,
        "expiresAt",
        expires.toString(),
        "moneyCollected",
        false);
  }

  public Object release(Actor a, UUID sid, UUID id, long revision) {
    var s = sessions.lock(a, sid, revision);
    var r = db.one("SELECT * FROM checkout_reservation WHERE id=? AND session_id=?", id, sid);
    if (a.guest() && !a.id().equals(Db.id(r, "payer_id"))) throw Problem.forbidden();
    if (a.staff()) access.staff(a, Db.id(s, "restaurant_id"));
    if (!Db.text(r, "status").equals("HELD"))
      throw Problem.conflict("This reservation is already closed.");
    db.update("UPDATE checkout_reservation SET status='RELEASED' WHERE id=?", id);
    sessions.event(a, s, "CHECKOUT_RELEASED", Map.of("reservationId", id));
    return Map.of("released", true);
  }

  private UUID payer(Actor a, UUID sid, BillingController.Checkout r) {
    if (a.guest()) {
      if (r.payerId() != null && !r.payerId().equals(a.id())) throw Problem.forbidden();
      return a.id();
    }
    if (r.payerId() == null) throw Problem.bad("Choose the payer for this staff preview.");
    validateGuests(sid, List.of(r.payerId()));
    return r.payerId();
  }

  private Set<UUID> targets(UUID sid, UUID payer, BillingController.Checkout r) {
    return switch (r.target()) {
      case "SELF" -> Set.of(payer);
      case "REMAINDER" -> Set.of();
      case "GUESTS" -> {
        validateGuests(sid, r.guestIds());
        yield new HashSet<>(r.guestIds());
      }
      default -> throw Problem.bad("Unknown checkout target.");
    };
  }

  private Map<String, Object> acceptedItem(UUID sid, UUID id) {
    return db.one(
        "SELECT * FROM order_item WHERE session_id=? AND id=? AND status"
            + " IN('ACCEPTED','PREPARING','READY','SERVED')",
        sid,
        id);
  }

  private void validateGuests(UUID sid, List<UUID> ids) {
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 20
        || new HashSet<>(ids).size() != ids.size()
        || ids.stream().anyMatch(Objects::isNull))
      throw Problem.bad("Select one to twenty different guests.");
    for (UUID id : ids)
      if (db.number(
              "SELECT count(*) FROM guest WHERE id=? AND session_id=? AND active=true", id, sid)
          != 1) throw Problem.bad("Every selected guest must be active at this table.");
  }
}
